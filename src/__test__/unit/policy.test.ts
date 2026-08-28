/**
 * The shared law: the rules every line is written against, tested on their own
 * because whether a given line applies them is that line's design, not their
 * meaning.
 */
import { describe, expect, it } from 'vitest';

import {
  INTERIM_AFTER_MINUTES,
  isSensitive,
  needsInterim,
  validateDraft,
} from '../../core/policy.ts';

describe('needsInterim', () => {
  it('stays quiet while the case is still fresh', () => {
    expect(
      needsInterim({
        elapsedMinutes: INTERIM_AFTER_MINUTES - 1,
        operatorHasSeen: false,
      }),
    ).toBe(false);
  });

  /** Once she has the case open, the answer is hers to send, however long it took. */
  it('stays quiet when the operator has already seen the case', () => {
    expect(
      needsInterim({
        elapsedMinutes: INTERIM_AFTER_MINUTES * 3,
        operatorHasSeen: true,
      }),
    ).toBe(false);
  });

  it('speaks up for a case that has waited unseen', () => {
    expect(
      needsInterim({
        elapsedMinutes: INTERIM_AFTER_MINUTES + 1,
        operatorHasSeen: false,
      }),
    ).toBe(true);
  });

  it('treats the threshold itself as passed', () => {
    expect(
      needsInterim({ elapsedMinutes: INTERIM_AFTER_MINUTES, operatorHasSeen: false }),
    ).toBe(true);
  });
});

describe('validateDraft', () => {
  it('passes a reply that mentions only orders the sender owns', () => {
    expect(validateDraft('ORD-2002 ships today.', ['ORD-2002'])).toEqual({ ok: true });
  });

  /** Either invented, or copied out of someone else's record. Both are failures. */
  it('catches a reply that mentions an order the sender was never shown to own', () => {
    expect(validateDraft('Your order ORD-1001 was delivered.', ['ORD-2002'])).toEqual({
      ok: false,
      reference: 'ORD-1001',
    });
  });

  it('has nothing to permit when no ownership was established', () => {
    expect(validateDraft('ORD-2002 ships today.', [])).toEqual({
      ok: false,
      reference: 'ORD-2002',
    });
  });
});

describe('isSensitive', () => {
  it('reads the list rather than the model', () => {
    expect(isSensitive('refund')).toBe(true);
    expect(isSensitive('shipping')).toBe(false);
  });
});
