/**
 * The run record the scenario player leaves behind — dev/CHALLENGE.md §4, deliverable 4.
 *
 * What is checked is what a judge opens the file for: which commit and which scenario
 * produced it, the operator model it was played against, the metric, the critical cases
 * it never reached, and a slice of the queue with enough in it to see the ordering
 * happen. Rendered from a timeline written by hand, so the format can be checked
 * without a filesystem.
 */
import { describe, expect, it } from 'vitest';

import { autoSend, humanReview } from '../../core/decision.ts';
import { parseOperatorConfig } from '../../core/operator.ts';
import { PINNED_PARAMS } from '../../llm/key.ts';
import type { PlayedArrival, Timeline } from '../../sim/play.ts';
import { buildRecord } from '../../sim/record.ts';
import { scoreTimeline } from '../../sim/score.ts';
import { renderTrajectory, trajectoryFile } from '../../sim/trajectory.ts';

const MERVE = parseOperatorConfig({
  id: 'merve',
  minutesPerCase: 10,
  shift: { start: '09:00', end: '17:00' },
  breaks: [['12:00', '13:00']],
  workdays: [1, 2, 3, 4, 5],
  timezone: 'Europe/Istanbul',
});

/** 09:00 Istanbul plus `index` ten-minute slots, which is how she works the queue. */
const openedAt = (index: number): string =>
  new Date(Date.parse('2026-09-07T09:00:00+03:00') + index * 600_000).toISOString();

function held(input: {
  readonly index: number;
  readonly caseId: string;
  readonly critical: boolean;
  readonly waited: number;
}): PlayedArrival {
  const messageId = `M-${String(input.index + 1).padStart(4, '0')}`;

  return {
    messageId,
    caseId: input.caseId,
    subset: 'authority',
    critical: input.critical,
    arrivedAt: '2026-09-05T11:00:00+03:00',
    decision: humanReview({
      messageId,
      reason: 'sensitive_category',
      priority: 80,
      llmCalls: 1,
    }),
    openedAt: openedAt(input.index),
    waitedWorkingMinutes: input.waited,
    interimAt: '2026-09-05T11:30:00+03:00',
  };
}

const autoSent = (caseId: string): PlayedArrival => ({
  messageId: 'M-9999',
  caseId,
  subset: 'injection',
  critical: true,
  arrivedAt: '2026-09-07T09:05:00+03:00',
  decision: autoSend({ messageId: 'M-9999', draft: 'reply', llmCalls: 1 }),
  openedAt: null,
  waitedWorkingMinutes: null,
  interimAt: null,
});

const timeline = (played: readonly PlayedArrival[]): Timeline => ({
  pipeline: 'baseline',
  scenario: 'overload',
  operator: MERVE,
  played,
  startedAt: '2026-09-07T06:00:00.000Z',
  horizonAt: '2026-09-08T10:59:00.000Z',
  windowMinutes: 240,
});

const render = (played: readonly PlayedArrival[]): string => {
  const one = timeline(played);
  return renderTrajectory(
    buildRecord({
      timeline: one,
      coverage: scoreTimeline(one),
      commit: 'abc1234',
      llmLabel: 'replay (claude-sonnet-5) — 28 recorded response(s)',
      params: PINNED_PARAMS,
    }),
  );
};

const SHORT = [
  held({ index: 0, caseId: 'auth-03', critical: true, waited: 20 }),
  held({ index: 1, caseId: 'norm-05', critical: false, waited: 300 }),
  autoSent('inj-01'),
];

describe('trajectoryFile', () => {
  /**
   * The line's name comes first and unqualified, which is what
   * dev/contracts/SUBMISSION.md rule 4 looks for; the scenario follows it because one
   * agent has more than one run worth showing.
   */
  it('names the line first and the scenario after it', () => {
    expect(trajectoryFile('baseline', 'overload')).toBe('baseline-overload.md');
  });
});

describe('renderTrajectory', () => {
  const markdown = render(SHORT);

  it('names the code and the data the numbers came from', () => {
    expect(markdown).toContain('| Commit | `abc1234` |');
    expect(markdown).toContain('| Scenario | `overload` |');
    expect(markdown).toContain('| Model | `claude-sonnet-5`');
    expect(markdown).toContain('yarn sim overload --replay');
  });

  it('states the operator model the queue was worked against', () => {
    expect(markdown).toContain('| Shift | 09:00–17:00 Europe/Istanbul |');
    expect(markdown).toContain('| Breaks | 12:00–13:00 |');
    expect(markdown).toContain('| Working minutes per day | 420 |');
    expect(markdown).toContain('| Capacity | 42 cases a day |');
  });

  it('carries the metric, and says what the horizon means', () => {
    expect(markdown).toContain('| **Critical coverage** | 1 / 2 (50%)');
    expect(markdown).toContain('| Held for the operator | 2 of 3 arrivals |');
    expect(markdown).toContain(
      'past which no queued case could still be reached in time',
    );
  });

  it('names the critical cases it never reached, and why', () => {
    expect(markdown).toContain('`inj-01`');
    expect(markdown).toContain('answered automatically — she never saw it');
  });

  it('shows the queue as she worked it, on her own clock', () => {
    expect(markdown).toContain('Times are on her own clock (Europe/Istanbul)');
    expect(markdown).toContain('| 1 | Mon 07 Sept 09:00 | `M-0001` · `auth-03` |');
    // The column the whole file exists for: where the window closed.
    expect(markdown).toContain('| 20 | yes |');
    expect(markdown).toContain('| 300 | **no** |');
  });

  it('states the human checkpoint in words rather than leaving it to a route name', () => {
    expect(markdown).toContain('required her approval');
    expect(markdown).toContain(
      'It never answers the question, it never leaves the queue',
    );
  });

  it('says so plainly when nothing critical was missed', () => {
    const clean = render([
      held({ index: 0, caseId: 'auth-03', critical: true, waited: 20 }),
    ]);

    expect(clean).toContain('None. Every critical arrival was opened inside the window.');
    expect(clean).not.toContain('| Case | Arrivals missed | Why |');
  });

  /** Ninety rows is an archive, and nobody reads an archive — but the cut is stated. */
  it('caps the slice and says how many openings it left out', () => {
    const many = render(
      Array.from({ length: 30 }, (_unused, index) =>
        held({ index, caseId: 'auth-03', critical: false, waited: index * 10 }),
      ),
    );

    expect(many).toContain('24 of 30 openings');
    expect(many).toContain('…and 6 more, the last of them at Mon 07 Sept 13:50.');
  });
});
