/**
 * The baseline line. Anchored in dev/CHALLENGE.md §8.
 *
 * Deliberately the reasonable simple approach, not a strawman: one model call, then
 * the risk decision at a single point. Its weaknesses are the thing being measured,
 * and each one is a choice a competent person would plausibly make.
 */
import { gateOnAuthority, permittedOrderIds, resolveAuthority } from '../authority.ts';
import { autoSend, humanReview, type Decision } from '../decision.ts';
import type { Pipeline } from '../pipeline.ts';
import { CONFIDENCE_THRESHOLD, isSensitive, validateDraft } from '../policy.ts';
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

    const messageId = message.messageId;
    const { category, confidence, draft } = output;

    const verdict = validateDraft(draft, permittedOrderIds(outcome));
    if (!verdict.ok) {
      return humanReview({
        messageId,
        reason: 'draft_policy_violation',
        draft,
        llmCalls: 1,
      });
    }

    if (isSensitive(category)) {
      return humanReview({ messageId, reason: 'sensitive_category', draft, llmCalls: 1 });
    }

    if (confidence < CONFIDENCE_THRESHOLD) {
      return humanReview({ messageId, reason: 'low_confidence', draft, llmCalls: 1 });
    }

    return autoSend({ messageId, draft, llmCalls: 1 });
  },
};
