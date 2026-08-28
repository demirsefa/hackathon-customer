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
