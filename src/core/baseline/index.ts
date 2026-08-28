/**
 * The baseline line, exactly as dev/CHALLENGE.md §8 describes it.
 *
 * One model call, then the risk decision at a single point: is the category the
 * model returned on the risky list? Nothing else. It is handed the record layer
 * like every line and never opens it — authority and ownership are read out of the
 * text, by the model, or not at all. That is the gap the primary metric measures,
 * and it is observable here rather than argued for in a README.
 *
 * It is not a strawman. The model's output is parsed rather than assumed, the
 * sensitive list is fixed in code rather than left to the model's judgement, the
 * approval gate is the same one every line uses, and every decision carries a reason
 * code. This is the solution a competent person actually writes first.
 */
import { autoSend, humanReview, type Decision } from '../decision.ts';
import type { Pipeline } from '../pipeline.ts';
import { isSensitive } from '../policy.ts';
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

  async run({ message, llm }): Promise<Decision> {
    const messageId = message.messageId;

    const response = await llm.complete({
      prompt: buildTriagePrompt(message.text, message.threadSummary),
    });

    const output = parseTriageOutput(response.text);
    if (output === null) {
      return humanReview({ messageId, reason: 'model_output_unusable', llmCalls: 1 });
    }

    const { category, urgency, draft } = output;

    if (isSensitive(category)) {
      // The only signal available for the read-first order is the model's own
      // urgency, so that is what the queue is sorted by.
      return humanReview({
        messageId,
        reason: 'sensitive_category',
        priority: urgency,
        draft,
        llmCalls: 1,
      });
    }

    return autoSend({ messageId, draft, llmCalls: 1 });
  },
};
