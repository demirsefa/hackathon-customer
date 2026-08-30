/**
 * The primary metric. A timeline in, the numbers out, and nothing else in the file.
 *
 * > **Critical case coverage** — of the arrivals ground truth marks `critical`, the
 * > share the operator actually opened within `CRITICAL_COVERAGE_MINUTES` **working**
 * > minutes of their arrival.
 *
 * Opened, not handled: the question dev/CHALLENGE.md §10 asks is whether the message
 * she genuinely needed to see reached her in time. A case a line auto-sent is one she
 * never saw at all, so it counts as missed however good the reply was — that is not a
 * technicality, it is the entire claim this project makes.
 *
 * Pure, for the reason `src/eval/score.ts` is pure: the numbers can be checked against
 * a timeline written by hand, with no scenario file and no model in the way.
 */
import type { PlayedArrival, Timeline } from './play.ts';

/** Why a critical arrival was not reached. Three different failures, three fixes. */
export type MissReason =
  /** The line answered it automatically. She never saw it — no ordering can help. */
  | 'auto_sent'
  /** Held for her, still in the queue when the run reached the horizon. */
  | 'not_reached'
  /** Held for her and opened — after the window had closed. */
  | 'opened_late';

export interface Miss {
  readonly messageId: string;
  readonly caseId: string;
  readonly arrivedAt: string;
  readonly reason: MissReason;
  /** Working minutes she took, or `null` when she never got there. */
  readonly waitedWorkingMinutes: number | null;
}

export interface Coverage {
  readonly pipeline: string;
  readonly scenario: string;
  readonly arrivals: number;
  readonly windowMinutes: number;
  /** Critical arrivals: the denominator, and the only one the headline uses. */
  readonly critical: number;
  readonly criticalReached: number;
  /** Every critical arrival that was not reached in time, in arrival order. */
  readonly missed: readonly Miss[];
  /** Held for the operator — the only arrivals that ever cost her a minute. */
  readonly queued: number;
  readonly opened: number;
  /** Held, and still unopened when the run reached the horizon. */
  readonly stillQueued: number;
  /** Mean working minutes from arrival to opening, over what she opened. */
  readonly averageWaitMinutes: number | null;
  readonly interimSent: number;
  readonly llmCalls: number;
}

/**
 * Whether the operator opened this arrival inside its window.
 *
 * Exported because `log.ts` states the same number in words and must not carry its own
 * copy of the predicate: a headline that disagrees with the metric block underneath it
 * is worse than a headline that is missing.
 */
export const reachedInTime = (arrival: PlayedArrival, windowMinutes: number): boolean =>
  arrival.waitedWorkingMinutes !== null && arrival.waitedWorkingMinutes <= windowMinutes;

function missReason(arrival: PlayedArrival, windowMinutes: number): MissReason {
  if (arrival.decision.route === 'auto_send') return 'auto_sent';
  return reachedInTime(arrival, windowMinutes) || arrival.openedAt === null
    ? 'not_reached'
    : 'opened_late';
}

export function scoreTimeline(timeline: Timeline): Coverage {
  const { played, windowMinutes } = timeline;

  const critical = played.filter((arrival) => arrival.critical);
  const queued = played.filter((arrival) => arrival.decision.route === 'human_review');
  const opened = played.filter((arrival) => arrival.waitedWorkingMinutes !== null);

  const waited = opened.map((arrival) => arrival.waitedWorkingMinutes ?? 0);

  return {
    pipeline: timeline.pipeline,
    scenario: timeline.scenario,
    arrivals: played.length,
    windowMinutes,
    critical: critical.length,
    criticalReached: critical.filter((arrival) => reachedInTime(arrival, windowMinutes))
      .length,
    missed: critical
      .filter((arrival) => !reachedInTime(arrival, windowMinutes))
      .map((arrival) => ({
        messageId: arrival.messageId,
        caseId: arrival.caseId,
        arrivedAt: arrival.arrivedAt,
        reason: missReason(arrival, windowMinutes),
        waitedWorkingMinutes: arrival.waitedWorkingMinutes,
      })),
    queued: queued.length,
    opened: opened.length,
    stillQueued: queued.length - opened.length,
    // Rounded to a whole minute: the operator model has no fractional case in it, and
    // a second decimal place on an average would suggest a precision the model lacks.
    averageWaitMinutes:
      waited.length === 0
        ? null
        : Math.round(
            waited.reduce((total, minutes) => total + minutes, 0) / waited.length,
          ),
    interimSent: played.filter((arrival) => arrival.interimAt !== null).length,
    llmCalls: played.reduce((total, arrival) => total + arrival.decision.llmCalls, 0),
  };
}

/**
 * The distinct cases she never reached in time, sorted by id.
 *
 * A scenario replays one case many times, so the message-level list repeats itself and
 * the case-level one is what a reader can act on: `auth-01` was missed is a design
 * gap, `M-0007, M-0041, M-0068` were missed is the same gap counted three times.
 */
export function missedCaseIds(coverage: Coverage): readonly string[] {
  return [...new Set(coverage.missed.map((miss) => miss.caseId))].sort();
}
