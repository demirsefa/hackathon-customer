/**
 * Enforcement for dev/contracts/FEATURE-PARITY.md.
 *
 * The project's primary number is the difference between two lines. If that
 * difference comes from a feature one has and the other lacks, the number measures
 * nothing — a missing `if`, not a better design. These checks pin the feature set,
 * the decision shape and the approval gate.
 *
 * SUSPENDED, NOT DELETED. Three assertions cannot run while `PIPELINES` holds one
 * line, and they come back with the advanced line (dev/CHALLENGE.md §9):
 *
 *   1. the same route and the same reason code on both sides of every case;
 *   2. `decisionFields` compared between the two lines rather than to a fixed list;
 *   3. the stated model-call budget as a comparison — one call against three.
 *
 * Until then the contract's cross-line half is suspended in the open, which is
 * recorded in the contract's Enforcement section too. It is not weakened quietly.
 */
import { describe, expect, it } from 'vitest';

import {
  decisionFields,
  honoursApprovalGate,
  type Decision,
} from '../../core/decision.ts';
import type { InboundMessage } from '../../core/message.ts';
import { PIPELINES, REQUIRED_FEATURES, type Pipeline } from '../../core/pipeline.ts';
import { createRecordStore } from '../../core/records.ts';
import { agreeingScript, scriptedLlm, type TaskName } from '../fakes.ts';

const records = createRecordStore({
  senders: [{ senderId: 'S-ALICE', displayName: 'Alice' }],
  orders: [{ orderId: 'ORD-2002', ownerSenderId: 'S-ALICE', status: 'placed' }],
});

function message(text: string, senderId = 'S-ALICE'): InboundMessage {
  return {
    messageId: 'M-1',
    senderId,
    receivedAt: '2026-08-28T09:00:00.000Z',
    text,
  };
}

const unusable: Record<TaskName, string> = {
  triage: 'sorry, I cannot help with that',
  classify: 'sorry, I cannot help with that',
  draft: 'sorry, I cannot help with that',
  verify: 'sorry, I cannot help with that',
};

/** The fields every decision carries, whichever line produced it. */
const DECISION_FIELDS: readonly string[] = [
  'draft',
  'llmCalls',
  'messageId',
  'priority',
  'reason',
  'requiresApproval',
  'route',
];

type Case = {
  readonly name: string;
  readonly message: InboundMessage;
  readonly script: Record<TaskName, string>;
  readonly expected: Decision['reason'];
};

/** One table, every line. Neither is measured on cases the other never sees. */
const CASES: readonly Case[] = [
  {
    name: 'routine question about an order the sender owns',
    message: message('Has ORD-2002 shipped yet?'),
    script: agreeingScript({
      category: 'shipping',
      urgency: 20,
      confidence: 0.95,
      draft: 'ORD-2002 leaves the warehouse today.',
    }),
    expected: 'routine_reply',
  },
  {
    name: 'sensitive category',
    message: message('I want my money back for ORD-2002.'),
    script: agreeingScript({
      category: 'refund',
      urgency: 80,
      confidence: 0.99,
      draft: 'Refund started.',
    }),
    expected: 'sensitive_category',
  },
  {
    name: 'model output cannot be used',
    message: message('Where is ORD-2002?'),
    script: unusable,
    expected: 'model_output_unusable',
  },
];

describe('feature parity', () => {
  it('every line declares exactly the required feature set', () => {
    const required = [...REQUIRED_FEATURES].sort();

    for (const pipeline of PIPELINES) {
      expect([...pipeline.features].sort()).toEqual(required);
    }
  });

  describe.each(PIPELINES.map((pipeline) => [pipeline.name, pipeline] as const))(
    '%s',
    (_name: string, pipeline: Pipeline) => {
      describe.each(CASES.map((testCase) => [testCase.name, testCase] as const))(
        '%s',
        (_caseName: string, testCase: Case) => {
          it('reaches the expected reason code, in the shared decision shape', async () => {
            const decision = await pipeline.run({
              message: testCase.message,
              records,
              llm: scriptedLlm(testCase.script),
            });

            expect(decision.reason).toBe(testCase.expected);
            expect(decisionFields(decision)).toEqual(DECISION_FIELDS);
          });

          it('honours the human-approval gate', async () => {
            const decision = await pipeline.run({
              message: testCase.message,
              records,
              llm: scriptedLlm(testCase.script),
            });

            expect(honoursApprovalGate(decision)).toBe(true);
          });
        },
      );
    },
  );
});
