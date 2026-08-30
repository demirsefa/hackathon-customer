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
 * The window the primary metric is measured over: a critical case counts as reached
 * only if the operator opened it within this many **working** minutes of its arrival.
 *
 * Four working hours. Working, not wall-clock: a message that lands at 17:30 on Friday
 * waits until Monday 09:00 because the desk is one person with a shift, and charging
 * that weekend against her would measure the calendar rather than the queue.
 *
 * It lives here, beside the other two named thresholds, for one reason — changing the
 * number has to be one edit in one file. A metric whose threshold is written down in
 * two places is a metric that reports two different numbers the day one of them moves.
 */
export const CRITICAL_COVERAGE_MINUTES = 4 * 60;

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

/**
 * Whether a message may not be answered without a human reading it first.
 *
 * Matched by containment rather than by equality, because the category is free text a
 * model wrote, not a value it chose from a menu. Asked to triage a refund demand the
 * recorded answers come back as `refund_request`, `returns_refunds` and `billing_dispute`
 * — none of which equals a word in the list above, and all three of which are the thing
 * the list is there to catch. Equality made the list depend on the model guessing our
 * vocabulary exactly, which is not a policy, it is a coincidence.
 *
 * It errs toward holding, and that direction is chosen. `src/eval/score.ts` states the
 * asymmetry the whole product turns on: a message held that could have been answered
 * costs the operator ten minutes, and a message auto-sent that should have been held
 * costs a customer and is already gone by the time anyone notices. So `no_refund_needed`
 * landing in her queue is a cost worth paying for `refund_request` never skipping it.
 *
 * What it does **not** fix: the model still names the category in whatever words and
 * whatever language it likes — one recorded answer is `iade_talebi` — and no amount of
 * string matching over that is a risk decision. That is the first weakness
 * dev/CHALLENGE.md §8 lists against the baseline, and it is the advanced line's job,
 * not this function's.
 */
export function isSensitive(category: string): boolean {
  const normalised = category.toLowerCase();
  return SENSITIVE_CATEGORIES.some((sensitive) => normalised.includes(sensitive));
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
