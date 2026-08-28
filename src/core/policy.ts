/**
 * The policy both pipelines share. Anchored in dev/contracts/FEATURE-PARITY.md.
 *
 * It lives in one file on purpose. Feature parity is easiest to break by improving
 * one implementation in place, and a rule that exists only inside baseline, or only
 * inside advanced, is exactly that break.
 */
import { autoSend, humanReview, type Decision } from './decision.ts';
import { extractOrderReferences } from './message.ts';

/** Categories a single-person desk should never answer without reading. */
export const SENSITIVE_CATEGORIES: readonly string[] = [
  'refund',
  'billing',
  'legal',
  'complaint',
  'account_access',
];

export const CONFIDENCE_THRESHOLD = 0.7;

/**
 * How long a queued case may sit unseen before the sender is told it was received.
 * Long enough that the operator working normally reaches it first; short enough that
 * a customer is never left in silence on a busy morning.
 */
export const INTERIM_AFTER_MINUTES = 30;

/**
 * Whether a queued case has waited long enough, unseen, to deserve an interim
 * message. The clock is an argument because `core/` never reads one, and
 * `operatorHasSeen` is what keeps this from talking over her: once she has opened
 * the case, the answer is hers to send, not ours.
 */
export function needsInterim(input: {
  readonly elapsedMinutes: number;
  readonly operatorHasSeen: boolean;
}): boolean {
  return !input.operatorHasSeen && input.elapsedMinutes >= INTERIM_AFTER_MINUTES;
}

export type DraftVerdict =
  { readonly ok: true } | { readonly ok: false; readonly reference: string };

/**
 * A reply may only mention orders the sender was shown to own. Anything else is
 * either invented or copied out of someone else's record — the two failures a draft
 * check exists to catch.
 */
export function validateDraft(
  draft: string,
  permittedOrderIds: readonly string[],
): DraftVerdict {
  const permitted = new Set(permittedOrderIds);

  for (const reference of extractOrderReferences(draft)) {
    if (!permitted.has(reference)) {
      return { ok: false, reference };
    }
  }

  return { ok: true };
}

/**
 * Turns a classified, drafted message into a decision. Called by both pipelines with
 * whatever their own passes produced, so the two can differ in how they arrive at a
 * category and a confidence but never in what those values mean.
 */
export function finalize(input: {
  readonly messageId: string;
  readonly category: string;
  readonly confidence: number;
  readonly draft: string;
  readonly permittedOrderIds: readonly string[];
  readonly llmCalls: number;
}): Decision {
  const { messageId, draft, llmCalls } = input;

  const verdict = validateDraft(draft, input.permittedOrderIds);
  if (!verdict.ok) {
    return humanReview({ messageId, reason: 'draft_policy_violation', draft, llmCalls });
  }

  if (SENSITIVE_CATEGORIES.includes(input.category)) {
    return humanReview({ messageId, reason: 'sensitive_category', draft, llmCalls });
  }

  if (input.confidence < CONFIDENCE_THRESHOLD) {
    return humanReview({ messageId, reason: 'low_confidence', draft, llmCalls });
  }

  return autoSend({ messageId, draft, llmCalls });
}
