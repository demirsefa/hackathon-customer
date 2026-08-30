/**
 * The primary metric, checked against timelines written by hand.
 *
 * No scenario file, no model, no clock — the whole reason `scoreTimeline` is pure. The
 * three ways a critical case is missed are asserted apart, because they are three
 * different failures: an ordering problem, a capacity problem, and a design problem
 * that no ordering can reach.
 */
import { describe, expect, it } from 'vitest';

import { autoSend, humanReview } from '../../core/decision.ts';
import { parseOperatorConfig } from '../../core/operator.ts';
import type { PlayedArrival, Timeline } from '../../sim/play.ts';
import { missedCaseIds, scoreTimeline } from '../../sim/score.ts';

const MERVE = parseOperatorConfig({
  id: 'merve',
  minutesPerCase: 10,
  shift: { start: '09:00', end: '17:00' },
  breaks: [['12:00', '13:00']],
  workdays: [1, 2, 3, 4, 5],
  timezone: 'Europe/Istanbul',
});

const WINDOW = 240;

/** One arrival the operator was handed, or was not. `waited === null` is unopened. */
function arrival(input: {
  readonly messageId: string;
  readonly caseId: string;
  readonly critical: boolean;
  readonly held: boolean;
  readonly waited: number | null;
  readonly interim?: boolean;
}): PlayedArrival {
  const decision = input.held
    ? humanReview({
        messageId: input.messageId,
        reason: 'sensitive_category',
        priority: 80,
        llmCalls: 1,
      })
    : autoSend({ messageId: input.messageId, draft: 'reply', llmCalls: 1 });

  return {
    messageId: input.messageId,
    caseId: input.caseId,
    subset: 'authority',
    critical: input.critical,
    arrivedAt: '2026-03-02T09:00:00+03:00',
    decision,
    openedAt: input.waited === null ? null : '2026-03-02T10:00:00+03:00',
    waitedWorkingMinutes: input.waited,
    interimAt: input.interim === true ? '2026-03-02T09:30:00+03:00' : null,
  };
}

const timeline = (played: readonly PlayedArrival[]): Timeline => ({
  pipeline: 'baseline',
  scenario: 'test',
  operator: MERVE,
  played,
  startedAt: '2026-03-02T06:00:00.000Z',
  horizonAt: '2026-03-02T11:00:00.000Z',
  windowMinutes: WINDOW,
});

describe('scoreTimeline', () => {
  it('counts a critical case as reached only inside the window', () => {
    const coverage = scoreTimeline(
      timeline([
        arrival({
          messageId: 'M-1',
          caseId: 'a',
          critical: true,
          held: true,
          waited: 239,
        }),
        arrival({
          messageId: 'M-2',
          caseId: 'b',
          critical: true,
          held: true,
          waited: 240,
        }),
        arrival({
          messageId: 'M-3',
          caseId: 'c',
          critical: true,
          held: true,
          waited: 241,
        }),
      ]),
    );

    expect(coverage.critical).toBe(3);
    expect(coverage.criticalReached).toBe(2);
    expect(coverage.missed.map((miss) => miss.messageId)).toEqual(['M-3']);
  });

  it('ignores an arrival ground truth did not mark critical', () => {
    const coverage = scoreTimeline(
      timeline([
        arrival({
          messageId: 'M-1',
          caseId: 'a',
          critical: false,
          held: true,
          waited: null,
        }),
      ]),
    );

    expect(coverage.critical).toBe(0);
    expect(coverage.criticalReached).toBe(0);
    expect(coverage.missed).toEqual([]);
  });

  /**
   * The row that matters most. An auto-sent case is not a slow case: the reply was
   * already with the customer, and no ordering could have put it in front of her.
   */
  it('tells the three ways a critical case is missed apart', () => {
    const coverage = scoreTimeline(
      timeline([
        arrival({
          messageId: 'M-1',
          caseId: 'a',
          critical: true,
          held: false,
          waited: null,
        }),
        arrival({
          messageId: 'M-2',
          caseId: 'b',
          critical: true,
          held: true,
          waited: null,
        }),
        arrival({
          messageId: 'M-3',
          caseId: 'c',
          critical: true,
          held: true,
          waited: 300,
        }),
      ]),
    );

    expect(coverage.missed.map((miss) => miss.reason)).toEqual([
      'auto_sent',
      'not_reached',
      'opened_late',
    ]);
  });

  it('separates what was held from what she got to', () => {
    const coverage = scoreTimeline(
      timeline([
        arrival({
          messageId: 'M-1',
          caseId: 'a',
          critical: false,
          held: false,
          waited: null,
        }),
        arrival({
          messageId: 'M-2',
          caseId: 'b',
          critical: false,
          held: true,
          waited: 20,
        }),
        arrival({
          messageId: 'M-3',
          caseId: 'c',
          critical: false,
          held: true,
          waited: null,
        }),
      ]),
    );

    expect(coverage.arrivals).toBe(3);
    expect(coverage.queued).toBe(2);
    expect(coverage.opened).toBe(1);
    expect(coverage.stillQueued).toBe(1);
  });

  it('averages the wait over what she opened, in whole working minutes', () => {
    const coverage = scoreTimeline(
      timeline([
        arrival({
          messageId: 'M-1',
          caseId: 'a',
          critical: false,
          held: true,
          waited: 10,
        }),
        arrival({
          messageId: 'M-2',
          caseId: 'b',
          critical: false,
          held: true,
          waited: 35,
        }),
        arrival({
          messageId: 'M-3',
          caseId: 'c',
          critical: false,
          held: true,
          waited: null,
        }),
      ]),
    );

    expect(coverage.averageWaitMinutes).toBe(23);
  });

  it('reports no average at all rather than a zero she never earned', () => {
    const coverage = scoreTimeline(
      timeline([
        arrival({
          messageId: 'M-1',
          caseId: 'a',
          critical: false,
          held: false,
          waited: null,
        }),
      ]),
    );

    expect(coverage.averageWaitMinutes).toBeNull();
  });

  it('counts the interim messages and the model calls', () => {
    const coverage = scoreTimeline(
      timeline([
        arrival({
          messageId: 'M-1',
          caseId: 'a',
          critical: false,
          held: true,
          waited: 40,
          interim: true,
        }),
        arrival({
          messageId: 'M-2',
          caseId: 'b',
          critical: false,
          held: true,
          waited: 10,
        }),
      ]),
    );

    expect(coverage.interimSent).toBe(1);
    expect(coverage.llmCalls).toBe(2);
  });
});

describe('missedCaseIds', () => {
  /**
   * A scenario replays one case many times, so the message-level list repeats itself.
   * `auth-01` was missed is a design gap; three message ids are the same gap counted
   * three times.
   */
  it('collapses repeats to distinct case ids, sorted', () => {
    const coverage = scoreTimeline(
      timeline([
        arrival({
          messageId: 'M-3',
          caseId: 'inj-01',
          critical: true,
          held: false,
          waited: null,
        }),
        arrival({
          messageId: 'M-1',
          caseId: 'auth-01',
          critical: true,
          held: false,
          waited: null,
        }),
        arrival({
          messageId: 'M-2',
          caseId: 'auth-01',
          critical: true,
          held: false,
          waited: null,
        }),
      ]),
    );

    expect(coverage.missed).toHaveLength(3);
    expect(missedCaseIds(coverage)).toEqual(['auth-01', 'inj-01']);
  });
});
