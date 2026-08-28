/**
 * The law both lines are written against. Anchored in dev/contracts/FEATURE-PARITY.md
 * rule 5.
 *
 * It lives in one file on purpose: a rule that exists only inside one line is a
 * parity break even when its behaviour matches. What is *not* fixed here is the
 * order the rules are applied in, or whether a line applies them at all — that is
 * the design each line is measured on.
 */
import { extractOrderReferences } from './message.ts';

/** Categories a single-person desk should never answer without reading. */
export const SENSITIVE_CATEGORIES: readonly string[] = [
  'refund',
  'billing',
  'legal',
  'complaint',
  'account_access',
];

/**
 * Below this, a model's own answer is not worth acting on unread.
 *
 * The rule lives here because it belongs to both lines; whether a line applies it is
 * the line's own design. The baseline does not — it has no concept of uncertainty at
 * all (dev/CHALLENGE.md §8), and that missing concept is part of what is measured.
 */
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

/** Categories a message may not be answered on without a human reading it first. */
export function isSensitive(category: string): boolean {
  return SENSITIVE_CATEGORIES.includes(category);
}

export type DraftVerdict =
  { readonly ok: true } | { readonly ok: false; readonly reference: string };

/**
 * A reply may only mention orders the sender was shown to own. Anything else is
 * either invented or copied out of someone else's record — the two failures a draft
 * check exists to catch.
 *
 * Shared law, applied by whichever line chooses to. The baseline does not run it
 * (dev/CHALLENGE.md §8: no draft validation), which is deliberate and measured.
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
