/**
 * Enforcement for dev/contracts/FEATURE-PARITY.md.
 *
 * The project's primary number is the difference between these two pipelines. If the
 * difference comes from a feature one has and the other lacks, the number measures
 * nothing. These checks pin the feature set, the decision shape and the gate; the
 * only difference they permit is the one the contract names out loud.
 */
import { describe, expect, it } from 'vitest';

import { decisionFields, honoursApprovalGate, type Decision } from '../core/decision.ts';
import type { InboundMessage } from '../core/message.ts';
import { advanced, baseline, REQUIRED_FEATURES } from '../core/pipelines.ts';
import { createRecordStore } from '../core/records.ts';
import { agreeingScript, scriptedLlm, type TaskName } from '../__mocks__/testing.ts';

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

type Case = {
  readonly name: string;
  readonly message: InboundMessage;
  readonly script: Record<TaskName, string>;
  readonly expected: Decision['reason'];
};

/** One table, both implementations. Neither is measured on cases the other never sees. */
const CASES: readonly Case[] = [
  {
    name: 'routine question about an order the sender owns',
    message: message('Has ORD-2002 shipped yet?'),
    script: agreeingScript({
      category: 'shipping',
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
      confidence: 0.99,
      draft: 'Refund started.',
    }),
    expected: 'sensitive_category',
  },
  {
    name: 'model is unsure',
    message: message('the thing is weird again'),
    script: agreeingScript({
      category: 'other',
      confidence: 0.3,
      draft: 'Could you clarify?',
    }),
    expected: 'low_confidence',
  },
  {
    name: 'model output cannot be used',
    message: message('Where is ORD-2002?'),
    script: unusable,
    expected: 'model_output_unusable',
  },
  {
    name: 'sender does not own the order',
    message: message('Where is ORD-4004?'),
    script: agreeingScript({ category: 'shipping', confidence: 1, draft: 'On its way.' }),
    expected: 'unresolved_reference',
  },
];

describe('feature parity', () => {
  it('both implementations declare the same feature set', () => {
    const required = [...REQUIRED_FEATURES].sort();

    expect([...baseline.features].sort()).toEqual(required);
    expect([...advanced.features].sort()).toEqual(required);
  });

  describe.each(CASES.map((testCase) => [testCase.name, testCase] as const))(
    '%s',
    (_name: string, testCase: Case) => {
      it('produces the same decision shape and the same route on both sides', async () => {
        const input = { message: testCase.message, records };

        const fromBaseline = await baseline.run({
          ...input,
          llm: scriptedLlm(testCase.script),
        });
        const fromAdvanced = await advanced.run({
          ...input,
          llm: scriptedLlm(testCase.script),
        });

        expect(decisionFields(fromBaseline)).toEqual(decisionFields(fromAdvanced));
        expect(fromBaseline.route).toBe(fromAdvanced.route);
        expect(fromBaseline.reason).toBe(testCase.expected);
        expect(fromAdvanced.reason).toBe(testCase.expected);
      });

      it('honours the human-approval gate on both sides', async () => {
        const input = { message: testCase.message, records };

        const fromBaseline = await baseline.run({
          ...input,
          llm: scriptedLlm(testCase.script),
        });
        const fromAdvanced = await advanced.run({
          ...input,
          llm: scriptedLlm(testCase.script),
        });

        expect(honoursApprovalGate(fromBaseline)).toBe(true);
        expect(honoursApprovalGate(fromAdvanced)).toBe(true);
      });
    },
  );

  /**
   * The one permitted difference, asserted rather than left implicit: advanced spends
   * three model calls where the baseline spends one. Changing these numbers means
   * changing what the headline comparison costs, so it changes the contract too.
   */
  it('states the difference in model calls instead of hiding it', async () => {
    const script = agreeingScript({
      category: 'shipping',
      confidence: 0.95,
      draft: 'ORD-2002 leaves the warehouse today.',
    });
    const input = { message: message('Has ORD-2002 shipped yet?'), records };

    const fromBaseline = await baseline.run({ ...input, llm: scriptedLlm(script) });
    const fromAdvanced = await advanced.run({ ...input, llm: scriptedLlm(script) });

    expect(fromBaseline.llmCalls).toBe(1);
    expect(fromAdvanced.llmCalls).toBe(3);
  });
});
