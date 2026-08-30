/**
 * A coverage result as lines of terminal text. Formatting only — no arithmetic that
 * decides anything, and no I/O.
 *
 * It returns lines rather than printing them, so the shape of the output is a value a
 * test can read. Same rule `src/eval/report.ts` follows: the expensive number is never
 * buried in a column. Here it is the first row and it is the headline of the whole
 * project, and the cases she never reached are printed by id underneath it, because a
 * percentage says how bad the ordering was and the ids say what it was bad at.
 *
 * The two labels the other renderers in this folder need — the window, and an instant
 * on the operator's own clock — are exported from here for the same reason: `sim/` has
 * one place that decides how a number is worded, and one format written once.
 */
import type { Coverage } from './score.ts';
import { missedCaseIds } from './score.ts';

const percent = (part: number, whole: number): string =>
  whole === 0 ? '—' : `${String(Math.round((part / whole) * 100))}%`;

const perArrival = (calls: number, arrivals: number): string =>
  arrivals === 0 ? '—' : (calls / arrivals).toFixed(2);

const ids = (caseIds: readonly string[]): string =>
  caseIds.length === 0 ? 'none' : caseIds.join(', ');

/**
 * An instant on the operator's own wall clock, as `Mon 31 Aug 09:03`.
 *
 * Her zone rather than UTC or the reader's, because every sentence that quotes an
 * instant here is about her day: "opened at 06:03Z" is not something anybody can check
 * against a shift that starts at 09:00. The zone name is printed beside the times so
 * the offset is stated rather than assumed.
 *
 * It lives beside `windowLabel` for the reason that one does: `trajectory.ts` and
 * `log.ts` both write her times, and two copies of a clock format are two formats.
 */
export function localClock(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hourCycle: 'h23',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(instant));

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '?';

  return `${read('weekday')} ${read('day')} ${read('month')} ${read('hour')}:${read('minute')}`;
}

/** A minute of the day as `09:00`. Her shift, her breaks: the same two digits twice. */
export function dayClock(minuteOfDay: number): string {
  return `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;
}

/** `4h` reads better than `240 working minutes` and is the same number stated once. */
export function windowLabel(minutes: number): string {
  return minutes % 60 === 0
    ? `${String(minutes / 60)} working hour(s)`
    : `${String(minutes)} working minute(s)`;
}

export function reportLines(coverage: Coverage): readonly string[] {
  const { arrivals, critical, criticalReached, queued } = coverage;

  return [
    `${coverage.pipeline} — ${coverage.scenario} · ${String(arrivals)} arrival(s)`,
    '',
    `  CRITICAL COVERAGE         ${String(criticalReached)} / ${String(critical)}  (${percent(criticalReached, critical)})  opened within ${windowLabel(coverage.windowMinutes)}`,
    `  never reached in time     ${String(coverage.missed.length)} arrival(s), ${String(missedCaseIds(coverage).length)} case(s)`,
    `    ${ids(missedCaseIds(coverage))}`,
    '',
    `  held for the operator     ${String(queued)} of ${String(arrivals)}  (the rest were answered automatically)`,
    `  opened                    ${String(coverage.opened)} of ${String(queued)}  (${percent(coverage.opened, queued)})`,
    `  still queued              ${String(coverage.stillQueued)}  at the horizon`,
    `  average wait              ${coverage.averageWaitMinutes === null ? '—' : `${String(coverage.averageWaitMinutes)} working minute(s)`}`,
    `  interim messages sent     ${String(coverage.interimSent)}`,
    `  model calls               ${String(coverage.llmCalls)} total, ${perArrival(coverage.llmCalls, arrivals)} per arrival`,
  ];
}

/**
 * What stands for the run on stderr once every message has been through the line.
 *
 * It carries no duration, unlike the one `src/eval/` prints. This program produces the
 * published number and reads no clock at all — not in `core/`, not in `sim/`, not for a
 * progress line — so that the same commit and the same scenario give the same bytes.
 */
export function playedLine(input: {
  readonly pipeline: string;
  readonly scenario: string;
  readonly arrivals: number;
}): string {
  return `${input.pipeline}: ${String(input.arrivals)} arrival(s) of ${input.scenario} played`;
}
