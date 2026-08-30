/**
 * The operator's day, written so that it reads like a day.
 *
 * Three parts, in the order the thing actually happens: the queue the line handed her,
 * then her working down it one case at a time, then what it added up to. The numbers
 * are the same ones `score.ts` reports; the difference is that a person can read these
 * without a legend — "6 left in the queue" rather than `q 6`, "it had waited 20 min"
 * rather than a column of bare integers.
 *
 * **It never scores a case.** Whether a line routed a message the way ground truth
 * says it should have is `src/eval/`'s question and is answered there; a scenario
 * replays one case many times over a clock, and the only question here is whether the
 * operator reached it in time.
 *
 * Pure. It returns lines and never writes them, it reads no clock — every instant comes
 * out of the timeline — and the entry point puts it on **stderr**, so the metric block
 * on stdout is untouched.
 *
 * The `Paint` it is handed decides nothing about the words: given none it produces the
 * plain text the checks assert on, and given the terminal's it faints the scaffolding
 * and reddens the one row that says a case was reached too late.
 */
import { PLAIN, type Paint } from '../cli/paint.ts';
import {
  casesPerDay,
  workingMinutesBetween,
  type OperatorConfig,
} from '../core/operator.ts';
import { sortedQueue } from '../core/queue.ts';
import type { PlayedArrival, Timeline } from './play.ts';
import { dayClock, localClock } from './report.ts';

const MS_PER_MINUTE = 60_000;

/**
 * How much of the queue is listed before the count stands for the rest.
 *
 * Thirty is enough to see what the ordering did with the urgent end of it, which is the
 * part the metric is decided at, and short enough that somebody reads it.
 */
const QUEUE_ROWS = 30;

/** Ids are listed rather than counted, up to here; past it the count is the fact. */
const MAX_IDS = 8;

/** `2d 3h 10m`, largest unit first, zeroes dropped. `0m` for nothing at all. */
function spanLabel(minutes: number): string {
  const parts: string[] = [];
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const rest = minutes % 60;

  if (days > 0) parts.push(`${String(days)}d`);
  if (hours > 0) parts.push(`${String(hours)}h`);
  if (rest > 0 || parts.length === 0) parts.push(`${String(rest)}m`);

  return parts.join(' ');
}

const ids = (values: readonly string[]): string =>
  values.length <= MAX_IDS
    ? values.join(', ')
    : `${values.slice(0, MAX_IDS).join(', ')} and ${String(values.length - MAX_IDS)} more`;

/** `Mon`, `Sat` … in her zone, as an ISO weekday number. */
function isoWeekdayIn(timezone: string, instantMs: number): number {
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
  }).format(new Date(instantMs));

  const index = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(day);
  return index + 1;
}

/** The date in her zone as `2026-09-07`, for asking whether two instants share a day. */
const civilDate = (timezone: string, instantMs: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(instantMs));

/**
 * What the hours she was away actually were: a lunch hour, an evening, a weekend.
 *
 * Named rather than left as a number, because "off the clock for 64h" is a figure and
 * "the weekend" is the reason the queue on Monday morning looks the way it does.
 */
function awayLabel(input: {
  readonly operator: OperatorConfig;
  readonly fromMs: number;
  readonly toMs: number;
}): string {
  const zone = input.operator.timezone;

  if (civilDate(zone, input.fromMs) === civilDate(zone, input.toMs)) return 'her break';

  const days: number[] = [];
  for (let ms = input.fromMs; ms <= input.toMs; ms += 24 * 60 * MS_PER_MINUTE) {
    days.push(isoWeekdayIn(zone, ms));
  }
  days.push(isoWeekdayIn(zone, input.toMs));

  const workdays: readonly number[] = input.operator.workdays;

  return days.some((day) => !workdays.includes(day))
    ? 'the evening and the weekend'
    : 'the evening';
}

/**
 * What sat between two openings, when anything did.
 *
 * Two different silences, and they mean opposite things. Time **off the clock** is the
 * evening, the lunch hour or the weekend: the queue kept filling and she was not there.
 * Time with **nothing waiting** is inside her shift with an empty queue — the state
 * `overload` never reaches, and the one that says the desk is coping.
 */
function gapLines(input: {
  readonly operator: OperatorConfig;
  readonly fromMs: number;
  readonly toMs: number;
  readonly paint: Paint;
}): readonly string[] {
  const { operator } = input;

  const wall = Math.round((input.toMs - input.fromMs) / MS_PER_MINUTE);
  const working = workingMinutesBetween(
    operator,
    new Date(input.fromMs),
    new Date(input.toMs),
  );

  const away = wall - working;
  const idle = working - operator.minutesPerCase;

  return [
    ...(away >= 1
      ? [`off the clock for ${spanLabel(away)} — ${awayLabel({ ...input })}`]
      : []),
    ...(idle >= 1 ? [`nothing waiting for ${spanLabel(idle)}`] : []),
  ].map((reason) => input.paint.dim(`${' '.repeat(23)}${reason}`));
}

/** One line of the queue the line handed her, in the order the queue puts it. */
function queueRow(input: {
  readonly arrival: PlayedArrival;
  readonly place: number;
  readonly timezone: string;
}): string {
  const { arrival } = input;

  return [
    `     #${String(input.place).padEnd(3)}`,
    `${arrival.messageId} · ${arrival.caseId}`.padEnd(20),
    `priority ${String(arrival.decision.priority).padStart(3)}`,
    arrival.decision.reason.padEnd(22),
    `arrived ${localClock(arrival.arrivedAt, input.timezone)}`,
    arrival.critical ? 'critical' : '',
  ]
    .join('  ')
    .trimEnd();
}

/** One opening: when, which case, how long it had waited, and what is left behind it. */
function openingRow(input: {
  readonly arrival: PlayedArrival;
  readonly leftBehind: number;
  readonly timezone: string;
  readonly windowMinutes: number;
  readonly paint: Paint;
}): string {
  const { arrival } = input;
  const waited = arrival.waitedWorkingMinutes ?? 0;
  const late = waited - input.windowMinutes;

  // The padding goes inside the paint: an escape sequence counts towards `padEnd`, so
  // padding a painted string would shunt every column after it sideways on exactly the
  // rows that matter.
  const timing =
    late <= 0
      ? 'in time'.padEnd(16)
      : input.paint.alarm(`LATE by ${String(late)} min`.padEnd(16));

  return [
    `     ${localClock(arrival.openedAt ?? '', input.timezone).padEnd(17)}`,
    `opens ${`${arrival.messageId} · ${arrival.caseId}`.padEnd(20)}`,
    `it had waited ${String(waited).padStart(4)} min`,
    timing,
    `${String(input.leftBehind)} left in the queue`,
    arrival.critical ? 'critical' : '',
  ]
    .join('  ')
    .trimEnd();
}

/**
 * The whole day: the queue, the working of it, and what it came to.
 *
 * `queued` is what the line held for her and is the only thing she ever spends a minute
 * on. Everything else was answered automatically and is one sentence at the bottom,
 * because "38 never reached her" is the sentence the metric is made of.
 */
export function operatorLog(timeline: Timeline, paint: Paint = PLAIN): readonly string[] {
  const { operator, played, windowMinutes } = timeline;
  const zone = operator.timezone;

  const queued = played.filter((arrival) => arrival.decision.route === 'human_review');
  const opened = queued
    .filter((arrival) => arrival.openedAt !== null)
    .sort((left, right) => ((left.openedAt ?? '') < (right.openedAt ?? '') ? -1 : 1));

  // The queue's own order, out of `core/queue.ts` so this cannot drift from the order
  // she is actually served in. It is not the order she opens them in — a message that
  // has not arrived yet cannot be on top — which is exactly what part 2 shows.
  const queue = sortedQueue(
    queued.map((arrival) => ({
      messageId: arrival.messageId,
      priority: arrival.decision.priority,
      arrivedAtMs: Date.parse(arrival.arrivedAt),
      arrival,
    })),
  );

  /** Held, arrived, and not yet opened at that instant — the one she opens excluded. */
  const leftBehind = (instantMs: number): number =>
    queued.filter(
      (arrival) =>
        Date.parse(arrival.arrivedAt) <= instantMs &&
        (arrival.openedAt === null || Date.parse(arrival.openedAt) > instantMs),
    ).length;

  const breaks = operator.breaks
    .map((span) => `${dayClock(span.startMinute)}–${dayClock(span.endMinute)}`)
    .join(', ');

  const stillQueued = queued.filter((arrival) => arrival.openedAt === null);
  const interim = played.filter((arrival) => arrival.interimAt !== null);
  const critical = played.filter((arrival) => arrival.critical);
  const autoSent = played.filter((arrival) => arrival.decision.route === 'auto_send');
  const first = interim[0];

  return [
    paint.dim(`${operator.id} — ${timeline.pipeline} · ${timeline.scenario}`),
    '',
    `  ${String(played.length)} messages arrived. The line answered ${String(autoSent.length)} of them itself and left ${String(queued.length)} in her queue.`,
    `  She works ${dayClock(operator.shift.startMinute)}–${dayClock(operator.shift.endMinute)}${breaks === '' ? '' : ` with ${breaks} off`}, ${String(operator.minutesPerCase)} minutes a case — ${String(casesPerDay(operator))} cases fit in a day.`,
    '',
    paint.dim(
      `  1 · THE QUEUE SHE WAS HANDED — ${String(queued.length)} message(s), most urgent first`,
    ),
    '',
    ...queue
      .slice(0, QUEUE_ROWS)
      .map((entry, index) =>
        queueRow({ arrival: entry.arrival, place: index + 1, timezone: zone }),
      ),
    ...(queue.length > QUEUE_ROWS
      ? [
          paint.dim(
            `     the first ${String(QUEUE_ROWS)} of ${String(queue.length)}, the rest behind them`,
          ),
        ]
      : []),
    '',
    paint.dim(
      `  2 · HER DAY, ONE CASE AT A TIME — she opened ${String(opened.length)}; "in time" means within ${String(windowMinutes / 60)} working hours of arriving`,
    ),
    '',
    ...opened.flatMap((arrival, index): readonly string[] => {
      const openedAtMs = Date.parse(arrival.openedAt ?? '');
      const previous = opened[index - 1];
      const previousMs =
        previous === undefined ? null : Date.parse(previous.openedAt ?? '');

      return [
        ...(previousMs === null
          ? []
          : gapLines({ operator, fromMs: previousMs, toMs: openedAtMs, paint })),
        openingRow({
          arrival,
          leftBehind: leftBehind(openedAtMs),
          timezone: zone,
          windowMinutes,
          paint,
        }),
      ];
    }),
    '',
    paint.dim('  3 · WHAT IT ADDED UP TO'),
    '',
    `     ${String(autoSent.length)} message(s) never reached her — the line answered them itself, ${String(autoSent.filter((arrival) => arrival.critical).length)} of them critical.`,
    stillQueued.length === 0
      ? '     Nothing was left in the queue when the run ended.'
      : `     ${String(stillQueued.length)} still in the queue when the run ended: ${ids(stillQueued.map((arrival) => arrival.messageId))}.`,
    interim.length === 0 || first === undefined
      ? '     No interim message went out.'
      : `     ${String(interim.length)} interim message(s) went out; the first to ${first.messageId} at ${localClock(first.interimAt ?? '', zone)}.`,
    `     ${String(critical.length)} of the ${String(played.length)} arrivals were the ones she genuinely had to see.`,
    '',
  ];
}
