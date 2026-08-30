/**
 * The narration `yarn sim <scenario> --log` prints.
 *
 * Two things are worth a check and the rest is formatting. The queue depth and the gaps
 * have to come out of the timeline rather than out of a guess about her day — a run
 * that says `q 3` where three were waiting is worse than no log at all. And the block
 * must stay on its own subject: whether a decision matched ground truth is
 * `src/eval/`'s question, and a coverage run that answered it too would put two
 * differently-shaped verdicts in front of the same reader.
 *
 * Instants carry `+03:00` throughout, the zone the operator below works in.
 */
import { describe, expect, it } from 'vitest';

import { createPaint } from '../../cli/paint.ts';
import { autoSend, humanReview } from '../../core/decision.ts';
import { parseOperatorConfig } from '../../core/operator.ts';
import { operatorLog } from '../../sim/log.ts';
import type { PlayedArrival, Timeline } from '../../sim/play.ts';
import { stripColour } from '../fakes.ts';

const MERVE = parseOperatorConfig({
  id: 'merve',
  minutesPerCase: 10,
  shift: { start: '09:00', end: '17:00' },
  breaks: [['12:00', '13:00']],
  workdays: [1, 2, 3, 4, 5],
  timezone: 'Europe/Istanbul',
});

/** Mon 2026-03-02 … Fri 2026-03-06, the week `sim-play.test.ts` uses. */
const at = (day: string, time: string): string => `2026-03-${day}T${time}:00+03:00`;

const held = (input: {
  readonly messageId: string;
  readonly caseId: string;
  readonly arrivedAt: string;
  readonly openedAt: string | null;
  readonly waited: number | null;
  readonly critical?: boolean;
  readonly interimAt?: string | null;
}): PlayedArrival => ({
  messageId: input.messageId,
  caseId: input.caseId,
  subset: 'authority',
  critical: input.critical ?? false,
  arrivedAt: input.arrivedAt,
  decision: humanReview({
    messageId: input.messageId,
    reason: 'authority_mismatch',
    llmCalls: 1,
  }),
  openedAt: input.openedAt,
  waitedWorkingMinutes: input.waited,
  interimAt: input.interimAt ?? null,
});

const sent = (input: {
  readonly messageId: string;
  readonly critical: boolean;
}): PlayedArrival => ({
  messageId: input.messageId,
  caseId: 'norm-01',
  subset: 'normal',
  critical: input.critical,
  arrivedAt: at('02', '09:00'),
  decision: autoSend({ messageId: input.messageId, draft: 'here you go', llmCalls: 1 }),
  openedAt: null,
  waitedWorkingMinutes: null,
  interimAt: null,
});

const timeline = (played: readonly PlayedArrival[]): Timeline => ({
  pipeline: 'baseline',
  scenario: 'overload',
  operator: MERVE,
  played,
  startedAt: at('02', '09:00'),
  horizonAt: at('03', '13:00'),
  windowMinutes: 240,
});

const PLAYED: readonly PlayedArrival[] = [
  held({
    messageId: 'M-1',
    caseId: 'auth-01',
    arrivedAt: at('02', '08:30'),
    openedAt: at('02', '09:00'),
    waited: 0,
    critical: true,
    interimAt: at('02', '09:00'),
  }),
  held({
    messageId: 'M-2',
    caseId: 'auth-02',
    arrivedAt: at('02', '08:40'),
    openedAt: at('02', '09:10'),
    waited: 10,
  }),
  // Opened the next working morning: the evening and the night sit between the two.
  held({
    messageId: 'M-3',
    caseId: 'auth-03',
    arrivedAt: at('02', '08:45'),
    openedAt: at('03', '09:00'),
    waited: 420,
    critical: true,
  }),
  held({
    messageId: 'M-4',
    caseId: 'auth-04',
    arrivedAt: at('02', '08:50'),
    openedAt: null,
    waited: null,
    critical: true,
  }),
  sent({ messageId: 'M-5', critical: true }),
  sent({ messageId: 'M-6', critical: false }),
];

const lines = operatorLog(timeline(PLAYED));
const text = lines.join('\n');
const rowFor = (messageId: string): string =>
  lines.find((line) => line.includes(messageId)) ?? '';

describe('operatorLog', () => {
  it('names the operator, the line and the scenario she is working', () => {
    expect(lines[0]).toBe('merve — baseline · overload');
  });

  it('states the shift the whole walk is measured against', () => {
    expect(text).toContain('shift 09:00–17:00 Europe/Istanbul');
    expect(text).toContain('break 12:00–13:00');
    expect(text).toContain('10 min a case');
  });

  it('counts what was held for her apart from what arrived', () => {
    expect(text).toContain('4 of 6 arrival(s) held for her, 3 opened');
  });

  it('says how deep the queue was as she opened each case', () => {
    // Four held, all arrived before she starts: the first opening comes out of a queue
    // of four, and each one after it out of one fewer.
    expect(rowFor('M-1')).toContain('q 4');
    expect(rowFor('M-2')).toContain('q 3');
    expect(rowFor('M-3')).toContain('q 2');
  });

  it('marks a case opened past the window, which is the metric turning over', () => {
    expect(rowFor('M-1')).toContain('in window');
    expect(rowFor('M-3')).toContain('LATE');
  });

  it('marks the critical ones, since they are the only ones the metric counts', () => {
    expect(rowFor('M-1')).toContain('critical');
    expect(rowFor('M-2')).not.toContain('critical');
  });

  it('accounts for the hours she was not at the queue between two openings', () => {
    // 09:10 Monday to 09:00 Tuesday is 23h 50m of calendar, 6h 50m of it on her
    // clock — the evening, the night and the lunch hour are the other 17h.
    expect(text).toContain('17h off the clock');
  });

  it('reports idle minutes apart, because an empty queue is the opposite failure', () => {
    const idle = operatorLog(
      timeline([
        held({
          messageId: 'M-1',
          caseId: 'auth-01',
          arrivedAt: at('02', '09:00'),
          openedAt: at('02', '09:00'),
          waited: 0,
        }),
        held({
          messageId: 'M-2',
          caseId: 'auth-02',
          arrivedAt: at('02', '10:00'),
          openedAt: at('02', '10:00'),
          waited: 0,
        }),
      ]),
    ).join('\n');

    expect(idle).toContain('50m idle, nothing waiting');
    expect(idle).not.toContain('off the clock');
  });

  it('counts what she never saw, which no ordering could have reached', () => {
    expect(text).toContain('never in her queue    2 answered automatically, 1 of them');
  });

  it('names the ones still waiting when the run ended', () => {
    expect(text).toContain('still queued          1 at the horizon: M-4');
  });

  it('says how many interim messages went out, and when the first did', () => {
    expect(text).toContain('interim sent          1, first M-1 at Mon 02 Mar 09:00');
  });

  it('scores nothing: a verdict on a decision is the evaluation run’s to give', () => {
    expect(text).not.toContain('MISSED HOLD');
    expect(text).not.toContain('expected');
  });

  it('writes plain text unless a painter says the destination takes colour', () => {
    expect(text).not.toContain('\u001b');
  });

  it('paints the one row that costs something, and leaves the columns where they were', () => {
    const painted = operatorLog(timeline(PLAYED), createPaint({ colours: true }));
    const late = painted.find((line) => line.includes('M-3')) ?? '';

    expect(late).toContain('\u001b[1;31mLATE\u001b[0m');
    // Strip the escapes and the block is the one asserted above, column for column.
    expect(painted.map(stripColour)).toEqual(lines);
  });
});
