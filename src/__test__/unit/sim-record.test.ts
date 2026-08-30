/**
 * The raw half of the run the **primary metric** comes out of —
 * `trajectories/<line>-<scenario>.json`.
 *
 * Same claim as `eval-record.test.ts`, and it matters more here: the markdown shows
 * twenty-four openings out of ninety arrivals, so a reader who wants the other
 * sixty-six has only this file to go to. What is asserted is that it holds them, that
 * the headline number is a division anyone can redo from its own fields, and that the
 * document rendered beside it says nothing this file does not.
 */
import { describe, expect, it } from 'vitest';

import { autoSend, humanReview } from '../../core/decision.ts';
import { parseOperatorConfig } from '../../core/operator.ts';
import { PINNED_PARAMS } from '../../llm/key.ts';
import type { PlayedArrival, Timeline } from '../../sim/play.ts';
import {
  buildRecord,
  parseRecord,
  recordFile,
  serialiseRecord,
  SIM_SCHEMA,
} from '../../sim/record.ts';
import { scoreTimeline } from '../../sim/score.ts';
import { renderTrajectory } from '../../sim/trajectory.ts';

const MERVE = parseOperatorConfig({
  id: 'merve',
  minutesPerCase: 10,
  shift: { start: '09:00', end: '17:00' },
  breaks: [['12:00', '13:00']],
  workdays: [1, 2, 3, 4, 5],
  timezone: 'Europe/Istanbul',
});

const held = (input: {
  readonly index: number;
  readonly caseId: string;
  readonly waited: number;
}): PlayedArrival => {
  const messageId = `M-${String(input.index + 1).padStart(4, '0')}`;

  return {
    messageId,
    caseId: input.caseId,
    subset: 'authority',
    critical: true,
    arrivedAt: '2026-09-07T09:00:00+03:00',
    decision: humanReview({
      messageId,
      reason: 'sensitive_category',
      priority: 80,
      llmCalls: 1,
    }),
    openedAt: new Date(
      Date.parse('2026-09-07T09:00:00+03:00') + input.index * 600_000,
    ).toISOString(),
    waitedWorkingMinutes: input.waited,
    interimAt: null,
  };
};

/** Auto-sent and critical: the expensive miss, and the one the metric is built on. */
const autoSent = (caseId: string): PlayedArrival => ({
  messageId: `M-${caseId}`,
  caseId,
  subset: 'injection',
  critical: true,
  arrivedAt: '2026-09-07T09:05:00+03:00',
  decision: autoSend({ messageId: `M-${caseId}`, draft: 'reply', llmCalls: 1 }),
  openedAt: null,
  waitedWorkingMinutes: null,
  interimAt: null,
});

const PLAYED: readonly PlayedArrival[] = [
  held({ index: 0, caseId: 'auth-03', waited: 20 }),
  held({ index: 1, caseId: 'auth-05', waited: 300 }),
  autoSent('inj-01'),
];

const TIMELINE: Timeline = {
  pipeline: 'baseline',
  scenario: 'overload',
  operator: MERVE,
  played: PLAYED,
  startedAt: '2026-09-07T06:00:00.000Z',
  horizonAt: '2026-09-08T10:59:00.000Z',
  windowMinutes: 240,
};

const record = (): ReturnType<typeof buildRecord> =>
  buildRecord({
    timeline: TIMELINE,
    coverage: scoreTimeline(TIMELINE),
    commit: 'abc1234',
    llmLabel: 'replay (claude-sonnet-5) — 28 recorded response(s)',
    params: PINNED_PARAMS,
  });

describe('recordFile', () => {
  it('sits beside the markdown, under the same name', () => {
    expect(recordFile('baseline', 'overload')).toBe('baseline-overload.json');
  });
});

describe('the record the primary metric can be recomputed from', () => {
  it('states its schema', () => {
    expect(record().schema).toBe(SIM_SCHEMA);
  });

  it('names the scenario file, not only the scenario', () => {
    const { provenance } = record();

    expect(provenance.inputs.scenario).toBe('scenarios/overload.json');
    expect(provenance.command).toBe('yarn sim overload --replay');
    expect(provenance.commit).toBe('abc1234');
  });

  /** The headline is `criticalReached / critical`, and both are fields in the file. */
  it('carries the metric as two numbers a reader can divide themselves', () => {
    const { coverage } = record();

    expect(coverage.critical).toBe(3);
    expect(coverage.criticalReached).toBe(1);
    expect(coverage.windowMinutes).toBe(240);
  });

  it('carries every arrival, not the slice the markdown shows', () => {
    expect(record().timeline.played).toHaveLength(PLAYED.length);
    expect(record().timeline.played.map((arrival) => arrival.caseId)).toEqual([
      'auth-03',
      'auth-05',
      'inj-01',
    ]);
  });

  it('carries the operator model the queue was worked against', () => {
    expect(record().timeline.operator.minutesPerCase).toBe(10);
    expect(record().timeline.operator.timezone).toBe('Europe/Istanbul');
  });

  it('says why each critical arrival was missed, by message', () => {
    expect(record().coverage.missed).toContainEqual({
      messageId: 'M-inj-01',
      caseId: 'inj-01',
      arrivedAt: '2026-09-07T09:05:00+03:00',
      reason: 'auto_sent',
      waitedWorkingMinutes: null,
    });
  });
});

describe('the markdown is a view of the JSON', () => {
  it('renders identically from the object and from its serialisation', () => {
    const original = record();
    const roundTripped = parseRecord(serialiseRecord(original));

    expect(roundTripped).toEqual(original);
    expect(renderTrajectory(roundTripped)).toBe(renderTrajectory(original));
  });

  it('serialises to a stable document — same run in, same bytes out', () => {
    expect(serialiseRecord(record())).toBe(serialiseRecord(record()));
  });
});

describe('parseRecord', () => {
  it('refuses a document written against another schema', () => {
    const wrong = serialiseRecord(record()).replace(SIM_SCHEMA, 'something/else@9');
    expect(() => parseRecord(wrong)).toThrow(/schema is/);
  });

  it('refuses anything that is not an object', () => {
    expect(() => parseRecord('null')).toThrow(/expected a JSON object/);
  });
});
