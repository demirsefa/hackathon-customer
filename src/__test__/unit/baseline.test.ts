/**
 * The baseline line, checked against dev/CHALLENGE.md §8.
 *
 * Half of these assert what it does; the other half assert what it deliberately does
 * not do. Both halves matter — the primary metric is the distance between this line
 * and the one that reads the record layer, so the gap has to be pinned as carefully
 * as the behaviour.
 */
import { describe, expect, it } from 'vitest';

import { baseline } from '../../core/baseline/index.ts';
import { parseTriageOutput } from '../../core/baseline/triage.ts';
import type { InboundMessage } from '../../types/message.ts';
import type { RecordStore } from '../../types/records.ts';
import { agreeingScript, scriptedLlm, type TaskName } from '../fakes.ts';

/**
 * A record layer that cannot be read without failing the test. The baseline is
 * handed one like every line: "it never looks" is then an observed fact.
 */
const hostileRecords: RecordStore = {
  findOrder() {
    throw new Error('the baseline read the record layer');
  },
  findSender() {
    throw new Error('the baseline read the record layer');
  },
};

function message(text: string, threadSummary?: string): InboundMessage {
  return {
    messageId: 'M-1',
    senderId: 'S-ALICE',
    receivedAt: '2026-08-28T09:00:00.000Z',
    text,
    threadSummary,
  };
}

function run(input: {
  readonly text: string;
  readonly script: Record<TaskName, string>;
}) {
  const llm = scriptedLlm(input.script);
  return baseline
    .run({ message: message(input.text), records: hostileRecords, llm })
    .then((decision) => ({ decision, llm }));
}

const routine = agreeingScript({
  category: 'shipping',
  urgency: 20,
  confidence: 0.95,
  draft: 'ORD-2002 leaves the warehouse today.',
});

const refund = agreeingScript({
  category: 'refund',
  urgency: 73,
  confidence: 0.99,
  draft: 'I have started your refund.',
});

describe('baseline', () => {
  it('auto-sends a routine reply on one model call', async () => {
    const { decision, llm } = await run({
      text: 'Has ORD-2002 shipped?',
      script: routine,
    });

    expect(decision.route).toBe('auto_send');
    expect(decision.reason).toBe('routine_reply');
    expect(decision.requiresApproval).toBe(false);
    expect(decision.draft).toBe('ORD-2002 leaves the warehouse today.');
    expect(decision.llmCalls).toBe(1);
    expect(llm.calls).toBe(1);
  });

  it('holds a sensitive category and sorts it by the model urgency it was given', async () => {
    const { decision } = await run({ text: 'I want my money back.', script: refund });

    expect(decision.route).toBe('human_review');
    expect(decision.reason).toBe('sensitive_category');
    expect(decision.requiresApproval).toBe(true);
    expect(decision.priority).toBe(73);
    expect(decision.draft).toBe('I have started your refund.');
    expect(decision.llmCalls).toBe(1);
  });

  it('holds a message when the model output cannot be used', async () => {
    const { decision } = await run({
      text: 'Where is my parcel?',
      script: { ...routine, triage: 'sorry, I cannot help with that' },
    });

    expect(decision.route).toBe('human_review');
    expect(decision.reason).toBe('model_output_unusable');
    expect(decision.llmCalls).toBe(1);
  });

  it('holds a message when the urgency is outside the scale it asked for', async () => {
    const { decision } = await run({
      text: 'Where is my parcel?',
      script: {
        ...routine,
        triage: JSON.stringify({ category: 'shipping', urgency: 900, draft: 'Soon!' }),
      },
    });

    expect(decision.reason).toBe('model_output_unusable');
  });

  /**
   * The gap the primary metric measures. The record layer is right there, holding
   * the one fact that would answer "is this order this sender's order?", and this
   * line answers without it.
   */
  it('never opens the record layer it was handed', async () => {
    const { decision } = await run({
      text: 'Where is ORD-1001, the order I definitely own?',
      script: routine,
    });

    expect(decision.route).toBe('auto_send');
  });

  it('keeps the envelope out of the prompt', async () => {
    const { llm } = await run({ text: 'Where is ORD-2002?', script: routine });

    expect(llm.calls).toBe(1);
    for (const prompt of llm.prompts) {
      expect(prompt).not.toContain('S-ALICE');
      expect(prompt).not.toContain('ownerSenderId');
    }
  });
});

describe('parseTriageOutput', () => {
  it('accepts the contract it asked for', () => {
    const parsed = parseTriageOutput(
      JSON.stringify({ category: 'shipping', urgency: 0, draft: 'On its way.' }),
    );

    expect(parsed).toEqual({ category: 'shipping', urgency: 0, draft: 'On its way.' });
  });

  it.each([
    ['not JSON at all', 'I cannot help with that'],
    ['a missing draft', JSON.stringify({ category: 'shipping', urgency: 10 })],
    [
      'an urgency above the scale',
      JSON.stringify({ category: 'shipping', urgency: 101, draft: 'x' }),
    ],
    [
      'a negative urgency',
      JSON.stringify({ category: 'shipping', urgency: -1, draft: 'x' }),
    ],
    [
      'an urgency that is not a number',
      JSON.stringify({ category: 'shipping', urgency: 'high', draft: 'x' }),
    ],
  ])('rejects %s', (_name: string, raw: string) => {
    expect(parseTriageOutput(raw)).toBeNull();
  });
});
