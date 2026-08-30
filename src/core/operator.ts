/**
 * The operator's calendar, as pure functions.
 *
 * Merve is the whole support desk (dev/CHALLENGE.md §6). Her shift is what turns an
 * ordering into a number: the queue is not drained by a machine that never sleeps, it
 * is drained one case at a time, inside working hours, by one person. Every question
 * the primary metric asks — did she reach this case, and how long after it arrived —
 * is a question about this calendar.
 *
 * Nothing here reads a clock. The instant is always an argument, the same way it is
 * in `policy.ts`, so `eval/`, `sim/` and `service/` all get the same answer from the
 * same inputs.
 *
 * The config is written as JSON and read through `parseOperatorConfig`:
 *
 * ```json
 * {
 *   "id": "merve",
 *   "minutesPerCase": 10,
 *   "shift": { "start": "09:00", "end": "17:00" },
 *   "breaks": [["12:00", "13:00"]],
 *   "workdays": [1, 2, 3, 4, 5],
 *   "timezone": "Europe/Istanbul"
 * }
 * ```
 *
 * `timezone` is required rather than defaulted. Without it, "09:00" means whatever
 * the machine producing the number happens to think it means, and a run reproduced
 * on another laptop reports a different metric. Turkey is on permanent +03 today,
 * but that is a fact about a zone, not a fact about the code: every wall-clock
 * conversion below goes through the named zone.
 */

/** ISO-8601 weekday numbering: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** A half-open span of a local day, in whole minutes from local midnight. */
export type DaySpan = {
  readonly startMinute: number;
  readonly endMinute: number;
};

export type OperatorConfig = {
  readonly id: string;
  /** How long one case takes her. Whole minutes; there is no fractional case. */
  readonly minutesPerCase: number;
  readonly shift: DaySpan;
  /** Sorted, non-overlapping, inside the shift. Guaranteed by the parser. */
  readonly breaks: readonly DaySpan[];
  /** Sorted and unique. Guaranteed by the parser. */
  readonly workdays: readonly IsoWeekday[];
  /** An IANA zone name. Required — see the note at the top of this file. */
  readonly timezone: string;
};

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** "HH:MM" on a 24-hour clock. Anything else is a config error, not a value to guess. */
const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * A week and a day. Long enough to step over any arrangement of `workdays`, short
 * enough that a config with no working minutes at all reports itself instead of
 * spinning.
 */
const SEARCH_LIMIT_DAYS = 8;

type CivilDate = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

type CivilMoment = CivilDate & {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
};

// --- the zone boundary -----------------------------------------------------------

/**
 * Building an `Intl.DateTimeFormat` is the expensive half of every conversion below,
 * and the result depends only on the zone name, so it is kept. This is memoisation,
 * not state: the same name always yields the same formatter.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timezone);
  if (cached !== undefined) {
    return cached;
  }

  // `hourCycle: 'h23'` rather than `hour12: false`, which reports midnight as "24"
  // on some runtimes and would push every midnight into the following day.
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  formatters.set(timezone, created);
  return created;
}

/** The wall clock the operator reads at `epochMs`, in her own zone. */
function civilMomentAt(timezone: string, epochMs: number): CivilMoment {
  const parts = zoneFormatter(timezone).formatToParts(new Date(epochMs));

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    if (part === undefined) {
      throw new Error(`operator: zone "${timezone}" reported no ${type}`);
    }
    return Number(part.value);
  };

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** How far the zone runs ahead of UTC at `epochMs`. Whole minutes, DST included. */
function zoneOffsetMs(timezone: string, epochMs: number): number {
  const local = civilMomentAt(timezone, epochMs);
  const asIfUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );

  // Rounded to the minute because the formatted parts drop milliseconds, and every
  // real zone offset is a whole number of minutes.
  return Math.round((asIfUtc - epochMs) / MS_PER_MINUTE) * MS_PER_MINUTE;
}

/**
 * The instant at which the operator's clock reads `minuteOfDay` on `date`.
 *
 * The inverse direction needs two passes: the offset can only be read *at an
 * instant*, so the first pass reads it at the guess and the second reads it at the
 * corrected instant. Away from a transition both passes agree, which is every day of
 * the year in a zone like Europe/Istanbul; near one, the second pass is what keeps
 * the answer honest.
 */
function epochMsOfLocal(timezone: string, date: CivilDate, minuteOfDay: number): number {
  const asIfUtc =
    Date.UTC(date.year, date.month - 1, date.day) + minuteOfDay * MS_PER_MINUTE;
  const firstGuess = asIfUtc - zoneOffsetMs(timezone, asIfUtc);
  return asIfUtc - zoneOffsetMs(timezone, firstGuess);
}

// --- the civil calendar ----------------------------------------------------------

/**
 * `Date#getUTCDay()` numbers Sunday 0 … Saturday 6; `workdays` is ISO, Monday 1 …
 * Sunday 7. The conversion is spelled out here, once, because doing it implicitly is
 * the classic way to shift the whole week by a day — and `Date#getDay()` is never
 * used at all, since it would answer in the machine's zone rather than hers.
 */
function isoWeekdayOf(date: CivilDate): IsoWeekday {
  const sundayIsZero = new Date(
    Date.UTC(date.year, date.month - 1, date.day),
  ).getUTCDay();
  return (sundayIsZero === 0 ? 7 : sundayIsZero) as IsoWeekday;
}

/** Calendar arithmetic on the civil date alone — no zone involved, so none applied. */
function addDays(date: CivilDate, days: number): CivilDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function civilDaysBetween(from: CivilDate, to: CivilDate): number {
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / MS_PER_DAY);
}

function minuteOfDayOf(moment: CivilMoment): number {
  return moment.hour * 60 + moment.minute;
}

// --- the calendar itself ---------------------------------------------------------

/** The shift with the breaks cut out of it: when she is actually at the queue. */
export function workingSpans(config: OperatorConfig): readonly DaySpan[] {
  return spansOf(config.shift, config.breaks);
}

function spansOf(shift: DaySpan, breaks: readonly DaySpan[]): readonly DaySpan[] {
  const spans: DaySpan[] = [];
  let cursor = shift.startMinute;

  for (const pause of breaks) {
    if (pause.startMinute > cursor) {
      spans.push({ startMinute: cursor, endMinute: pause.startMinute });
    }
    cursor = Math.max(cursor, pause.endMinute);
  }

  if (shift.endMinute > cursor) {
    spans.push({ startMinute: cursor, endMinute: shift.endMinute });
  }

  return spans;
}

/** Minutes at the queue on one working day. 09:00–17:00 less an hour is 420. */
export function workingMinutesPerDay(config: OperatorConfig): number {
  return workingSpans(config).reduce(
    (total, span) => total + (span.endMinute - span.startMinute),
    0,
  );
}

/**
 * How many cases fit in a working day. At 10 minutes each that is 42 — against the
 * 60–80 a morning brings, which is why overload is the normal condition and why the
 * metric measures the *order* of the queue rather than its length.
 */
export function casesPerDay(config: OperatorConfig): number {
  return Math.floor(workingMinutesPerDay(config) / config.minutesPerCase);
}

/**
 * Is she at the queue at this instant? Working day, inside the shift, outside every
 * break. Spans are half-open: 12:00 is already the break, 13:00 is already back.
 */
export function isWorking(config: OperatorConfig, instant: Date): boolean {
  const local = civilMomentAt(config.timezone, instant.getTime());
  if (!config.workdays.includes(isoWeekdayOf(local))) {
    return false;
  }

  const minute = minuteOfDayOf(local);
  return workingSpans(config).some(
    (span) => minute >= span.startMinute && minute < span.endMinute,
  );
}

/**
 * The first instant from `instant` onwards at which she is at the queue. Returns
 * `instant` itself when she already is, so a caller can pass every arrival through
 * this without asking twice.
 *
 * This is the function that makes a Friday 17:00 arrival wait until Monday 09:00 —
 * the case sat unread all weekend, and the metric has to say so.
 */
export function nextWorkingMinute(config: OperatorConfig, instant: Date): Date {
  if (isWorking(config, instant)) {
    return instant;
  }

  const epochMs = instant.getTime();
  const spans = workingSpans(config);
  const today = civilMomentAt(config.timezone, epochMs);

  for (let offset = 0; offset <= SEARCH_LIMIT_DAYS; offset += 1) {
    const date = addDays(today, offset);
    if (!config.workdays.includes(isoWeekdayOf(date))) {
      continue;
    }

    for (const span of spans) {
      const start = epochMsOfLocal(config.timezone, date, span.startMinute);
      if (start > epochMs) {
        return new Date(start);
      }
    }
  }

  throw new Error(
    `operator: "${config.id}" has no working minute within ${SEARCH_LIMIT_DAYS} days of ${instant.toISOString()}`,
  );
}

/**
 * Working minutes in the half-open range `[from, to)`. Time outside the shift, in a
 * break, or on a weekend counts for nothing.
 *
 * This is what the primary metric is built on: "was the case opened within N working
 * hours of arriving" is this number compared against a budget, and a weekend must
 * not spend that budget.
 */
export function workingMinutesBetween(
  config: OperatorConfig,
  from: Date,
  to: Date,
): number {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  if (toMs <= fromMs) {
    return 0;
  }

  const spans = workingSpans(config);
  const firstDay = civilMomentAt(config.timezone, fromMs);
  const lastDay = civilMomentAt(config.timezone, toMs);

  // Milliseconds throughout, so the total is integer arithmetic and the minutes are
  // taken once at the end rather than rounded per day.
  let overlapMs = 0;

  for (let offset = 0; offset <= civilDaysBetween(firstDay, lastDay); offset += 1) {
    const date = addDays(firstDay, offset);
    if (!config.workdays.includes(isoWeekdayOf(date))) {
      continue;
    }

    for (const span of spans) {
      const spanStart = epochMsOfLocal(config.timezone, date, span.startMinute);
      const spanEnd = epochMsOfLocal(config.timezone, date, span.endMinute);
      const overlap = Math.min(spanEnd, toMs) - Math.max(spanStart, fromMs);
      if (overlap > 0) {
        overlapMs += overlap;
      }
    }
  }

  return Math.floor(overlapMs / MS_PER_MINUTE);
}

/**
 * The instant at which `minutes` working minutes have passed after `from`.
 *
 * The inverse of `workingMinutesBetween`, and the reason it exists: the operator takes
 * ten minutes over a case, and where those ten minutes land depends on whether a break,
 * an evening or a weekend sits inside them. A case she picks up at 16:55 is finished at
 * 09:05 the next working morning, not at 17:05 that evening.
 *
 * Counting starts at the first working minute at or after `from`, so `minutes = 0`
 * answers `nextWorkingMinute` and a caller never has to ask twice. The result is the
 * instant the budget runs out, which at the end of a span is the span's own end —
 * 16:50 plus ten minutes is 17:00, a minute she is no longer at the queue for, and
 * `workingMinutesBetween(from, result)` is still exactly `minutes`.
 */
export function advanceWorkingMinutes(
  config: OperatorConfig,
  from: Date,
  minutes: number,
): Date {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error(
      `operator: cannot advance by ${String(minutes)} working minutes — it must be a whole number, zero or more`,
    );
  }

  const fromMs = from.getTime();
  const spans = workingSpans(config);
  const today = civilMomentAt(config.timezone, fromMs);

  let remainingMs = minutes * MS_PER_MINUTE;

  for (let offset = 0; offset <= SEARCH_LIMIT_DAYS; offset += 1) {
    const date = addDays(today, offset);
    if (!config.workdays.includes(isoWeekdayOf(date))) {
      continue;
    }

    for (const span of spans) {
      // Clamped to `from`, so a span already half spent today contributes only the
      // half that is still ahead of the instant asked about.
      const start = Math.max(
        epochMsOfLocal(config.timezone, date, span.startMinute),
        fromMs,
      );
      const available = epochMsOfLocal(config.timezone, date, span.endMinute) - start;
      if (available <= 0) {
        continue;
      }
      if (available >= remainingMs) {
        return new Date(start + remainingMs);
      }
      remainingMs -= available;
    }
  }

  throw new Error(
    `operator: "${config.id}" has no ${String(minutes)} working minutes within ${SEARCH_LIMIT_DAYS} days of ${from.toISOString()}`,
  );
}

// --- the parser ------------------------------------------------------------------

function fail(message: string): never {
  throw new Error(`operator config: ${message}`);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    fail(`${label} must be a whole number of minutes greater than zero`);
  }
  return value;
}

function parseTimeOfDay(value: unknown, label: string): number {
  const text = requireNonEmptyString(value, label);
  const match = TIME_OF_DAY.exec(text);
  if (match === null) {
    fail(`${label} must be "HH:MM" on a 24-hour clock, not "${text}"`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function asTimeOfDay(minuteOfDay: number): string {
  const hours = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
  const minutes = String(minuteOfDay % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function parseTimezone(value: unknown): string {
  const name = requireNonEmptyString(value, 'timezone');
  try {
    zoneFormatter(name);
  } catch {
    fail(`timezone "${name}" is not a zone this runtime knows`);
  }
  return name;
}

function parseShift(value: unknown): DaySpan {
  const source = asRecord(value, 'shift');
  const startMinute = parseTimeOfDay(source.start, 'shift.start');
  const endMinute = parseTimeOfDay(source.end, 'shift.end');

  if (startMinute >= endMinute) {
    fail(
      `shift.start (${asTimeOfDay(startMinute)}) must come before shift.end (${asTimeOfDay(endMinute)})`,
    );
  }

  return { startMinute, endMinute };
}

function parseBreaks(value: unknown, shift: DaySpan): readonly DaySpan[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    fail('breaks must be an array of ["HH:MM", "HH:MM"] pairs');
  }

  const spans = value.map((entry, index): DaySpan => {
    const label = `breaks[${index}]`;
    if (!Array.isArray(entry) || entry.length !== 2) {
      fail(`${label} must be a ["HH:MM", "HH:MM"] pair`);
    }

    const startMinute = parseTimeOfDay(entry[0], `${label} start`);
    const endMinute = parseTimeOfDay(entry[1], `${label} end`);

    if (startMinute >= endMinute) {
      fail(`${label} must start before it ends`);
    }
    if (startMinute < shift.startMinute || endMinute > shift.endMinute) {
      fail(
        `${label} (${asTimeOfDay(startMinute)}–${asTimeOfDay(endMinute)}) falls outside the shift`,
      );
    }

    return { startMinute, endMinute };
  });

  const sorted = [...spans].sort((left, right) => left.startMinute - right.startMinute);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (
      previous !== undefined &&
      current !== undefined &&
      current.startMinute < previous.endMinute
    ) {
      fail(
        `breaks overlap: ${asTimeOfDay(previous.startMinute)}–${asTimeOfDay(previous.endMinute)} and ${asTimeOfDay(current.startMinute)}–${asTimeOfDay(current.endMinute)}`,
      );
    }
  }

  return sorted;
}

function parseWorkdays(value: unknown): readonly IsoWeekday[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail('workdays must be a non-empty array of ISO weekdays (1 = Monday … 7 = Sunday)');
  }

  const seen = new Set<number>();
  const days: IsoWeekday[] = [];

  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 1 || entry > 7) {
      fail(
        `workdays entry ${JSON.stringify(entry)} is not an ISO weekday (1 = Monday … 7 = Sunday)`,
      );
    }
    if (seen.has(entry)) {
      fail(`workdays lists day ${entry} twice`);
    }
    seen.add(entry);
    days.push(entry as IsoWeekday);
  }

  return days.sort((left, right) => left - right);
}

/**
 * The only way an `OperatorConfig` is built. A calendar read out of a scenario file
 * is untrusted input like any other: a shift that ends before it starts, or a break
 * hanging outside it, would not fail — it would quietly produce a different metric.
 */
export function parseOperatorConfig(value: unknown): OperatorConfig {
  const source = asRecord(value, 'the config');

  const shift = parseShift(source.shift);
  const breaks = parseBreaks(source.breaks, shift);

  const spans = spansOf(shift, breaks);
  if (spans.length === 0) {
    fail('the breaks leave no working minutes in the shift');
  }

  return {
    id: requireNonEmptyString(source.id, 'id'),
    minutesPerCase: requirePositiveInteger(source.minutesPerCase, 'minutesPerCase'),
    shift,
    breaks,
    workdays: parseWorkdays(source.workdays),
    timezone: parseTimezone(source.timezone),
  };
}
