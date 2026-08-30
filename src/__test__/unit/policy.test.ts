/**
 * The shared law: the rules every line is written against, tested on their own
 * because whether a given line applies them is that line's design, not their
 * meaning.
 */
import { describe, expect, it } from 'vitest';

import {
  draftCommitsToSensitiveAction,
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

  /**
   * The categories are free text a model wrote, and these five are the ones it actually
   * wrote in `fixtures/llm-cache.json` for messages the list exists to catch. Equality
   * caught none of them.
   */
  it.each([
    'refund_request',
    'returns_refunds',
    'billing_dispute',
    'account_access_issue',
    'legal_threat',
  ])('catches %s, which no entry in the list equals', (category) => {
    expect(isSensitive(category)).toBe(true);
  });

  it('is not confused by case', () => {
    expect(isSensitive('Refund_Request')).toBe(true);
    expect(isSensitive('BILLING')).toBe(true);
  });

  /**
   * Deliberately held rather than answered. The asymmetry is in `src/eval/score.ts`:
   * an unnecessary hold costs ten minutes, a wrong auto-send costs a customer.
   */
  it('errs toward holding when a sensitive word appears at all', () => {
    expect(isSensitive('no_refund_needed')).toBe(true);
  });

  it('still lets an ordinary category through', () => {
    expect(isSensitive('order_status')).toBe(false);
    expect(isSensitive('delivery_feedback')).toBe(false);
    expect(isSensitive('product_support')).toBe(false);
  });

  /** The limit, stated: a category in another language is not reachable this way. */
  it('does not pretend to read a category the model wrote in Turkish', () => {
    expect(isSensitive('iade_talebi')).toBe(false);
  });
});

describe('draftCommitsToSensitiveAction', () => {
  /**
   * The recorded `amb-02` draft, which is the whole reason the rule exists: the
   * classifier called it `wrong_item_received` and was sure, and the reply it led to
   * offers to refund the order outright.
   */
  it('catches a reply that offers a refund the classifier never mentioned', () => {
    expect(
      draftCommitsToSensitiveAction(
        'Size doğru rengi ücretsiz olarak gönderebiliriz veya tam iade yapabiliriz.',
      ),
    ).toBe(true);
  });

  /** The categories arrive in English and the replies in Turkish. Both, or neither. */
  it('reads the promise in either language', () => {
    expect(draftCommitsToSensitiveAction('We can issue a full refund today.')).toBe(true);
    expect(draftCommitsToSensitiveAction('Para iadesi yapabiliriz.')).toBe(true);
  });

  it('is not confused by case', () => {
    expect(draftCommitsToSensitiveAction('A REFUND is possible.')).toBe(true);
    expect(draftCommitsToSensitiveAction('Tam İADE yapılacaktır.')).toBe(true);
  });

  /**
   * Substring matching is what covers the inflections, and listing them out is what
   * the term list is deliberately not doing.
   */
  it.each(['iadesi', 'iadeyi', 'refunds', 'refunded'])(
    'reaches %s without listing it',
    (word) => {
      expect(draftCommitsToSensitiveAction(`... ${word} ...`)).toBe(true);
    },
  );

  /**
   * The number this rule is measured on is unnecessary holds, and it is zero. These
   * are the ordinary replies the line writes on the committed set; none of them may
   * be caught.
   */
  it.each([
    'ORD-1042 bugün kargoya veriliyor, takip numarasını paylaşacağız.',
    'Yes, we ship to İzmir.',
    'Kılavuzun PDF halini e-postanıza gönderdik.',
    'Kargo takip numaranızı yeniledik, ORD-1046 yolda.',
  ])('lets an ordinary reply through: %s', (draft) => {
    expect(draftCommitsToSensitiveAction(draft)).toBe(false);
  });
});
