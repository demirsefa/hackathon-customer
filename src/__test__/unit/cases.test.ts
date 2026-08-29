/**
 * The committed evaluation set, checked against dev/CHALLENGE.md §10.
 *
 * These are not checks on `parseCaseFile` alone — they are checks on the data. The
 * set is the instrument every number in this project is measured with, so the parts
 * that make it an instrument are pinned: the subset counts, the record layer being
 * complete, and the deliberate holes in it being deliberate rather than typos.
 *
 * The last one matters most. A case whose sender is missing, or whose order does not
 * resolve, is indistinguishable from a fixture mistake unless it is named here.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CASE_SUBSETS, parseCaseFile, type CaseSubset } from '../../core/cases.ts';
import { extractOrderReferences } from '../../core/message.ts';

const caseFile = parseCaseFile(
  JSON.parse(
    readFileSync(new URL('../../../fixtures/cases.json', import.meta.url), 'utf8'),
  ),
);

const { cases, senders, orders } = caseFile;

/** dev/CHALLENGE.md §10, exactly. */
const EXPECTED_COUNTS: Readonly<Record<CaseSubset, number>> = {
  normal: 10,
  injection: 8,
  authority: 6,
  ambiguous: 4,
};

/**
 * The one message from someone the record layer has never seen. It is in the
 * `authority` subset because that is what it is — the text is a perfectly ordinary
 * question, and the only thing wrong with it is who is asking.
 */
const UNKNOWN_SENDER_CASE = { caseId: 'auth-06', senderId: 'S-VOLKAN' };

/** Order numbers that resolve to nothing on purpose: a mistyped reference. */
const UNRESOLVED_REFERENCES: readonly (readonly [string, string])[] = [
  ['amb-01', 'ORD-9911'],
  ['amb-04', 'ORD-1099'],
];

const senderIds = new Set(senders.map((sender) => sender.senderId));
const orderById = new Map(orders.map((order) => [order.orderId, order]));

describe('the evaluation set', () => {
  it('carries 28 cases in the subset sizes the brief fixes', () => {
    const counted = Object.fromEntries(
      CASE_SUBSETS.map((subset) => [
        subset,
        cases.filter((entry) => entry.subset === subset).length,
      ]),
    );

    expect(counted).toEqual(EXPECTED_COUNTS);
    expect(cases).toHaveLength(28);
  });

  it('identifies every case and every message exactly once', () => {
    expect(new Set(cases.map((entry) => entry.caseId)).size).toBe(cases.length);
    expect(new Set(cases.map((entry) => entry.message.messageId)).size).toBe(
      cases.length,
    );
  });

  it('resolves every sender but the one that is meant to be missing', () => {
    const unknown = cases
      .filter((entry) => !senderIds.has(entry.message.senderId))
      .map((entry) => ({ caseId: entry.caseId, senderId: entry.message.senderId }));

    expect(unknown).toEqual([UNKNOWN_SENDER_CASE]);
  });

  it('resolves every order reference but the ones that are meant to be missing', () => {
    const unresolved = cases.flatMap((entry) =>
      extractOrderReferences(entry.message.text)
        .filter((reference) => !orderById.has(reference))
        .map((reference) => [entry.caseId, reference] as const),
    );

    expect(unresolved).toEqual(UNRESOLVED_REFERENCES);
  });

  it('points every order at a sender the record layer knows', () => {
    const orphaned = orders.filter((order) => !senderIds.has(order.ownerSenderId));

    expect(orphaned).toEqual([]);
  });

  /**
   * The constraint the whole comparison rests on. In these cases nothing in the text
   * is wrong — the sender is real, the order is real, the request is ordinary — and
   * the only wrong thing is that the order belongs to someone else. No reading of the
   * text can find that, so a set without them measures prompt quality, not design.
   */
  it('holds at least four authority cases the text cannot give away', () => {
    const mismatched = cases
      .filter((entry) => entry.subset === 'authority')
      .filter((entry) =>
        extractOrderReferences(entry.message.text).some((reference) => {
          const order = orderById.get(reference);
          return order !== undefined && order.ownerSenderId !== entry.message.senderId;
        }),
      )
      .map((entry) => entry.caseId);

    expect(mismatched.length).toBeGreaterThanOrEqual(4);
    expect(mismatched).toEqual(['auth-01', 'auth-02', 'auth-03', 'auth-04', 'auth-05']);
  });

  it('marks as critical only what the operator genuinely had to reach', () => {
    const critical = cases.filter((entry) => entry.critical);

    // Every critical case is one that belongs in front of her; the reverse does not
    // hold, which is the point of the field existing separately from the route.
    expect(critical.every((entry) => entry.expectedRoute === 'human_review')).toBe(true);
    expect(critical.length).toBeLessThan(cases.length / 2);
  });
});

describe('parseCaseFile', () => {
  it('refuses a file that is not an object', () => {
    expect(() => parseCaseFile([])).toThrow(/root must be an object/);
  });

  it('names the field that is wrong', () => {
    expect(() =>
      parseCaseFile({ senders: [], orders: [], cases: [{ caseId: 7 }] }),
    ).toThrow(/cases\[0\]\.caseId must be a non-empty string/);
  });

  it('refuses a subset outside the four the brief fixes', () => {
    const entry = { ...cases[0], subset: 'urgent' };

    expect(() => parseCaseFile({ ...caseFile, cases: [entry] })).toThrow(
      /cases\[0\]\.subset must be one of normal, injection, authority, ambiguous/,
    );
  });

  it('refuses a route it would have to guess the meaning of', () => {
    const entry = { ...cases[0], expectedRoute: 'maybe' };

    expect(() => parseCaseFile({ ...caseFile, cases: [entry] })).toThrow(
      /cases\[0\]\.expectedRoute must be one of auto_send, human_review/,
    );
  });

  it('refuses a timestamp with no offset, because a queue is ordered by it', () => {
    const entry = {
      ...cases[0],
      message: { ...cases[0]?.message, receivedAt: '2026-08-31T08:05:00' },
    };

    expect(() => parseCaseFile({ ...caseFile, cases: [entry] })).toThrow(
      /cases\[0\]\.message\.receivedAt must be an ISO timestamp/,
    );
  });

  it('refuses an empty thread summary rather than passing it to a prompt', () => {
    const entry = {
      ...cases[0],
      message: { ...cases[0]?.message, threadSummary: '' },
    };

    expect(() => parseCaseFile({ ...caseFile, cases: [entry] })).toThrow(
      /cases\[0\]\.message\.threadSummary must be a non-empty string/,
    );
  });
});
