/**
 * The operator's calendar as a value: one person's shift, breaks and working week.
 *
 * Merve is the whole support desk (dev/CHALLENGE.md §6), and this is the shape that
 * says when she is at it. The functions that answer questions about it live in
 * `core/operator.ts`; the config is written as JSON and read through
 * `parseOperatorConfig` there:
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
 * conversion in `core/operator.ts` goes through the named zone.
 */

/** ISO-8601 weekday numbering: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** A half-open span of a local day, in whole minutes from local midnight. */
export interface DaySpan {
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface OperatorConfig {
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
}
