/**
 * The baseline line. Anchored in dev/CHALLENGE.md §8.
 *
 * Deliberately the reasonable simple approach, not a strawman: one model call, then
 * the risk decision at a single point. Its weaknesses are the thing being measured,
 * and each one is a choice a competent person would plausibly make.
 */
import { gateOnAuthority, permittedOrderIds, resolveAuthority } from '../authority.ts';
import { humanReview, type Decision } from '../decision.ts';
import type { Pipeline } from '../pipeline.ts';
import { finalize } from '../policy.ts';
import { buildTriagePrompt, parseTriageOutput } from './triage.ts';

export const baseline: Pipeline = {
  name: 'baseline',
  features: [
    'assigns-category',
    'assigns-urgency',
    'produces-draft',
    'risky-never-auto-sent',
    'queued-case-carries-reason',
    'interim-message-on-threshold',
    'reason-code-on-every-decision',
  ],

  async run({ message, records, llm }): Promise<Decision> {
    const outcome = resolveAuthority(message, records);
    const held = gateOnAuthority(message.messageId, outcome);
    if (held !== null) return held;

    const response = await llm.complete({
      prompt: buildTriagePrompt(message.text, message.threadSummary),
    });
    const output = parseTriageOutput(response.text);
    if (output === null) {
      return humanReview({
        messageId: message.messageId,
        reason: 'model_output_unusable',
        llmCalls: 1,
      });
    }

    return finalize({
      messageId: message.messageId,
      category: output.category,
      confidence: output.confidence,
      draft: output.draft,
      permittedOrderIds: permittedOrderIds(outcome),
      llmCalls: 1,
    });
  },
};
