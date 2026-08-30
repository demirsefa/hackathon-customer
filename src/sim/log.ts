/**
 * The operator's day, written out line by line. `yarn sim <scenario> --log`.
 *
 * The report beside this one says how the ordering did; this one says what she did:
 * every case she opened, in her order, with the queue depth she opened it out of, the
 * gaps where the shift or the weekend was in the way, and the ones the horizon closed
 * on while they were still waiting. Nothing here is part of the metric — it is the same
 * timeline the coverage number is read off, said out loud instead of summed.
 *
 * **It never scores a case.** Whether a line routed a message the way ground truth says
 * it should have is `src/eval/`'s question and is answered in `src/eval/log.ts`; asking
 * it again over ninety arrivals would put a second, differently-shaped verdict list in
 * front of a reader who came for the queue. This file reports what happened to a
 * message, not whether the decision behind it was right.
 *
 * Pure, and off unless asked for. It returns lines and never writes them, it reads no
 * clock — every instant comes out of the timeline — and the entry point puts it on
 * **stderr**, so the metric on stdout is byte for byte what it was without the flag.
 *
 * The `Paint` it is handed decides nothing about the words: given none it produces the
 * plain text the checks assert on, and given the terminal's it faints the scaffolding
 * and reddens the one row that says a case was reached too late. The rule about when a
 * destination may take an escape at all is `src/cli/paint.ts`'s.
 */
import { PLAIN, type Paint } from '../cli/paint.ts';
import {
  casesPerDay,
  workingMinutesBetween,
  type OperatorConfig,
} from '../core/operator.ts';
import type { PlayedArrival, Timeline } from './play.ts';
import { dayClock, localClock } from './report.ts';

const MS_PER_MINUTE = 60_000;

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
    : `${values.slice(0, MAX_IDS).join(', ')}, …${String(values.length - MAX_IDS)} more`;

function operatorLine(operator: OperatorConfig): string {
  const breaks = operator.breaks
    .map((span) => `break ${dayClock(span.startMinute)}–${dayClock(span.endMinute)}`)
    .join(' · ');

  return [
    `shift ${dayClock(operator.shift.startMinute)}–${dayClock(operator.shift.endMinute)} ${operator.timezone}`,
    ...(breaks === '' ? [] : [breaks]),
    `${String(operator.minutesPerCase)} min a case`,
    `${String(casesPerDay(operator))} cases a day`,
  ].join(' · ');
}

/**
 * What sat between two openings, when anything did.
 *
 * Two different silences, and they mean opposite things. Minutes **off the clock** are
 * the evening, the lunch hour or the weekend: the queue kept filling and she was not
 * there. Minutes **idle** are inside her shift with nothing waiting — the state
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
    ...(away >= 1 ? [`${spanLabel(away)} off the clock`] : []),
    ...(idle >= 1 ? [`${spanLabel(idle)} idle, nothing waiting`] : []),
  ].map((reason) => input.paint.dim(`        ⋯ ${reason}`));
}

/** One opening, as the row it is: when, out of how deep a queue, and how late. */
function openingLine(input: {
  readonly arrival: PlayedArrival;
  readonly waiting: number;
  readonly timezone: string;
  readonly windowMinutes: number;
  readonly paint: Paint;
}): string {
  const { arrival } = input;
  const waited = arrival.waitedWorkingMinutes ?? 0;

  // Painted inside the four characters and padded outside them, so a colour never
  // reaches the column arithmetic: an escape sequence counts towards `padEnd` and
  // would shunt every column after it sideways on exactly the rows that matter.
  const window =
    waited <= input.windowMinutes ? 'in window' : `${input.paint.alarm('LATE')}     `;

  return [
    // Padded because `Sept` is four letters and `Sep` is three: a month boundary inside
    // one run must not shunt every column after it sideways.
    `  ${localClock(arrival.openedAt ?? '', input.timezone).padEnd(17)}`,
    `q${String(input.waiting).padStart(2)}`,
    `${arrival.messageId} · ${arrival.caseId}`.padEnd(20),
    `p${String(arrival.decision.priority).padStart(2)}`,
    arrival.decision.reason.padEnd(22),
    `waited ${String(waited).padStart(4)} min`,
    window,
    arrival.critical ? 'critical' : '',
  ]
    .join('  ')
    .trimEnd();
}

/**
 * The whole day, header to horizon.
 *
 * `queued` is what the line held for her and is the only thing she ever spends a minute
 * on; everything else was answered automatically and is counted once at the bottom,
 * because "she never saw 68 of the 90" is the sentence the metric is made of.
 */
export function operatorLog(timeline: Timeline, paint: Paint = PLAIN): readonly string[] {
  const { operator, played, windowMinutes } = timeline;
  const zone = operator.timezone;

  const queued = played.filter((arrival) => arrival.decision.route === 'human_review');
  const opened = queued
    .filter((arrival) => arrival.openedAt !== null)
    .sort((left, right) => ((left.openedAt ?? '') < (right.openedAt ?? '') ? -1 : 1));

  /** Arrived and not yet opened at that instant — the one she is opening included. */
  const waitingAt = (instantMs: number): number =>
    queued.filter(
      (arrival) =>
        Date.parse(arrival.arrivedAt) <= instantMs &&
        (arrival.openedAt === null || Date.parse(arrival.openedAt) >= instantMs),
    ).length;

  const rows = opened.flatMap((arrival, index): readonly string[] => {
    const openedAtMs = Date.parse(arrival.openedAt ?? '');
    const previous = opened[index - 1];
    const previousMs =
      previous === undefined ? null : Date.parse(previous.openedAt ?? '');

    return [
      ...(previousMs === null
        ? []
        : gapLines({ operator, fromMs: previousMs, toMs: openedAtMs, paint })),
      openingLine({
        arrival,
        waiting: waitingAt(openedAtMs),
        timezone: zone,
        windowMinutes,
        paint,
      }),
    ];
  });

  const stillQueued = queued.filter((arrival) => arrival.openedAt === null);
  const interim = played.filter((arrival) => arrival.interimAt !== null);
  const autoSent = played.filter((arrival) => arrival.decision.route === 'auto_send');
  const first = interim[0];

  return [
    // The header and the three lines under the rows are the frame around the thing
    // being read, so they are faint where a terminal can make them faint.
    paint.dim(`${operator.id} — ${timeline.pipeline} · ${timeline.scenario}`),
    paint.dim(`  ${operatorLine(operator)}`),
    paint.dim(
      `  at the queue from ${localClock(timeline.startedAt, zone)} until ${localClock(timeline.horizonAt, zone)}`,
    ),
    paint.dim(
      `  ${String(queued.length)} of ${String(played.length)} arrival(s) held for her, ${String(opened.length)} opened`,
    ),
    '',
    ...rows,
    '',
    paint.dim(
      `  never in her queue    ${String(autoSent.length)} answered automatically, ${String(autoSent.filter((arrival) => arrival.critical).length)} of them critical`,
    ),
    paint.dim(
      `  still queued          ${String(stillQueued.length)} at the horizon${stillQueued.length === 0 ? '' : `: ${ids(stillQueued.map((arrival) => arrival.messageId))}`}`,
    ),
    paint.dim(
      `  interim sent          ${String(interim.length)}${first === undefined ? '' : `, first ${first.messageId} at ${localClock(first.interimAt ?? '', zone)}`}`,
    ),
    '',
  ];
}
