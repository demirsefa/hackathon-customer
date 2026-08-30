/**
 * The scenario player: arrivals and a calendar in, a timeline out.
 *
 * Two halves, kept apart on purpose.
 *
 * `decide` hands each arrival to a line, one at a time, in arrival order. Nothing here
 * batches: dev/CHALLENGE.md §10 requires messages to be processed singly, because a
 * model handed a batch finds a contradiction by comparison — an advantage it will never
 * have on a real desk. There is no `Promise.all` in this file for the same reason, and
 * because the order answers land in is the order the cache is written in.
 *
 * `walkQueue` is pure and synchronous, and knows nothing about a model. It is where the
 * primary metric is actually produced: the operator, her queue, and the clock. Splitting
 * it out is what lets the ordering be checked against decisions written by hand, with no
 * scenario file, no cache and no network anywhere near the test.
 *
 * **No clock is read.** Every instant in a timeline comes from the scenario or from
 * `core/operator.ts` arithmetic over it, so the same commit and the same scenario
 * produce the same bytes on any machine, on any day.
 */
import type { CaseSubset } from '../core/cases.ts';
import type { Decision } from '../core/decision.ts';
import type { LlmClient } from '../core/llm.ts';
import {
  advanceWorkingMinutes,
  nextWorkingMinute,
  workingMinutesBetween,
  type OperatorConfig,
} from '../core/operator.ts';
import type { Pipeline } from '../core/pipeline.ts';
import { INTERIM_AFTER_MINUTES, needsInterim } from '../core/policy.ts';
import { sortedQueue, type QueueEntry } from '../core/queue.ts';
import type { RecordStore } from '../core/records.ts';
import type { ResolvedArrival } from '../core/scenario.ts';

const MS_PER_MINUTE = 60_000;

/**
 * One arrival the walk has to place: when it landed, how urgent the line said it was,
 * and whether it reached her queue at all.
 */
export type Pending = QueueEntry & {
  readonly caseId: string;
  /**
   * `human_review` reaches her queue; `auto_send` never does. An automatic reply is
   * already with the customer, and dev/CHALLENGE.md §10's operator model has her spend
   * her ten minutes only on what was held for her — which is the whole value of the
   * product and, when a line holds back the wrong things, the whole cost of it.
   */
  readonly queued: boolean;
};

/** One case she opened, at the instant she opened it. */
export type Opening = {
  readonly messageId: string;
  readonly openedAtMs: number;
  /** Arrival to opening, in working minutes. Weekends and evenings count for nothing. */
  readonly waitedWorkingMinutes: number;
};

export type Walk = {
  /** The first working minute at or after the earliest arrival. */
  readonly startedAtMs: number;
  /**
   * When the run stops, and what "still queued" is counted at.
   *
   * Four working hours after the **last** arrival: past that instant no case left in
   * the queue can still be reached inside its window, so playing on would move no
   * number the metric reports — while leaving the horizon undefined would make "still
   * queued" mean whatever the loop happened to feel like.
   */
  readonly horizonMs: number;
  /** In the order she opened them, which is the order the queue put them in. */
  readonly openings: readonly Opening[];
};

/**
 * The operator working her queue, top down, from the first arrival to the horizon.
 *
 * She makes no decisions: she takes whatever the ordering put on top, spends
 * `minutesPerCase` working minutes on it, and takes the next one. Everything the
 * metric reports is a consequence of the order — which is the point.
 */
export function walkQueue(input: {
  readonly operator: OperatorConfig;
  readonly arrivals: readonly Pending[];
  /** Overrides the window the horizon is set by. Tests use it; the run does not. */
  readonly windowMinutes: number;
}): Walk {
  const { operator } = input;
  const queue = input.arrivals.filter((arrival) => arrival.queued);

  const arrivalTimes = input.arrivals.map((arrival) => arrival.arrivedAtMs);
  if (arrivalTimes.length === 0) {
    throw new Error('sim: a scenario with no arrivals has no timeline to walk');
  }

  const firstMs = Math.min(...arrivalTimes);
  const lastMs = Math.max(...arrivalTimes);

  const startedAtMs = nextWorkingMinute(operator, new Date(firstMs)).getTime();
  const horizonMs = advanceWorkingMinutes(
    operator,
    new Date(lastMs),
    input.windowMinutes,
  ).getTime();

  const openings: Opening[] = [];
  const opened = new Set<string>();
  let nowMs = startedAtMs;

  while (opened.size < queue.length && nowMs < horizonMs) {
    const waiting = queue.filter(
      (entry) => !opened.has(entry.messageId) && entry.arrivedAtMs <= nowMs,
    );

    if (waiting.length === 0) {
      // An empty queue inside her shift: nothing to do but wait for the next message.
      // Only `normal-day` reaches this branch — under overload the queue never empties,
      // which is what dev/CHALLENGE.md §10 means by overload being the normal condition.
      const upcoming = queue
        .filter((entry) => !opened.has(entry.messageId))
        .map((entry) => entry.arrivedAtMs);

      if (upcoming.length === 0) break;
      nowMs = nextWorkingMinute(operator, new Date(Math.min(...upcoming))).getTime();
      continue;
    }

    const top = sortedQueue(waiting)[0];
    if (top === undefined) {
      throw new Error('sim: a non-empty queue produced no top entry');
    }

    openings.push({
      messageId: top.messageId,
      openedAtMs: nowMs,
      waitedWorkingMinutes: workingMinutesBetween(
        operator,
        new Date(top.arrivedAtMs),
        new Date(nowMs),
      ),
    });
    opened.add(top.messageId);

    // Ten minutes of *her* time, not ten minutes of the calendar's. A case picked up at
    // 16:55 finishes the next working morning, and the case behind it starts there.
    const finishedMs = advanceWorkingMinutes(
      operator,
      new Date(nowMs),
      operator.minutesPerCase,
    ).getTime();

    // `advanceWorkingMinutes` lands on the end of a span when the budget runs out
    // there — 17:00, a minute she is no longer at the queue for — so the cursor is
    // pushed forward to the next minute she actually is.
    nowMs = nextWorkingMinute(operator, new Date(finishedMs)).getTime();
  }

  return { startedAtMs, horizonMs, openings };
}

/**
 * When the interim message went out for one queued case, or `null` when none did.
 *
 * The threshold is **wall-clock**, unlike everything else here: a customer waiting on a
 * Saturday does not know about a shift, and telling them on Monday that we received
 * their message on Saturday is not an acknowledgement, it is an apology. The rest of
 * the metric is in working minutes because it measures the operator; this one number
 * measures the silence the sender actually experiences.
 *
 * It changes nothing about the queue. The case stays where it is, it still requires
 * approval, and the answer is still hers to send — dev/CHALLENGE.md §7, feature 6.
 * Because it moves nothing, it is derived from the finished timeline rather than
 * interleaved into the walk, and the walk stays a function of the ordering alone.
 */
function interimAt(input: {
  readonly arrivedAtMs: number;
  readonly openedAtMs: number | null;
  readonly horizonMs: number;
}): number | null {
  // The end of the span in which she has not looked: the moment she opens it, or the
  // end of the run. `operatorHasSeen` below is false for exactly that span — not a
  // constant chosen here, but what this instant establishes.
  const unseenUntilMs = Math.min(input.openedAtMs ?? input.horizonMs, input.horizonMs);

  const elapsedMinutes = Math.floor((unseenUntilMs - input.arrivedAtMs) / MS_PER_MINUTE);
  if (!needsInterim({ elapsedMinutes, operatorHasSeen: false })) return null;

  return input.arrivedAtMs + INTERIM_AFTER_MINUTES * MS_PER_MINUTE;
}

/** One arrival, played: what the line decided, and what the operator then did. */
export type PlayedArrival = {
  readonly messageId: string;
  readonly caseId: string;
  readonly subset: CaseSubset;
  readonly critical: boolean;
  readonly arrivedAt: string;
  readonly decision: Decision;
  /** When she opened it, or `null` — still queued when the run reached the horizon. */
  readonly openedAt: string | null;
  readonly waitedWorkingMinutes: number | null;
  readonly interimAt: string | null;
};

export type Timeline = {
  readonly pipeline: string;
  readonly scenario: string;
  readonly operator: OperatorConfig;
  /** In arrival order, which is the order the line saw them in. */
  readonly played: readonly PlayedArrival[];
  readonly startedAt: string;
  readonly horizonAt: string;
  /** The window a critical case had to be opened inside. Stated, never inferred. */
  readonly windowMinutes: number;
};

/** One arrival, the moment the line is done with it. Handed out rather than printed. */
export type ArrivalProgress = {
  /** 1-based, so it reads as "7 of 90" rather than as an index. */
  readonly done: number;
  readonly total: number;
  readonly messageId: string;
  readonly caseId: string;
  readonly llmCalls: number;
};

/**
 * Plays one scenario through one line.
 *
 * A replay miss is not caught here. `src/eval/` collects them because an empty cache is
 * a state a judge legitimately starts from; by the time a scenario runs, the cache is a
 * committed deliverable that covers every case, so a miss means the recorded run and
 * this one are not the same run. That has to stop the program, not be counted.
 */
export async function playScenario(input: {
  readonly pipeline: Pipeline;
  readonly scenario: string;
  readonly operator: OperatorConfig;
  readonly arrivals: readonly ResolvedArrival[];
  readonly records: RecordStore;
  readonly llm: LlmClient;
  readonly windowMinutes: number;
  readonly onArrival?: (progress: ArrivalProgress) => void;
}): Promise<Timeline> {
  const decisions: Decision[] = [];

  for (const arrival of input.arrivals) {
    const decision = await input.pipeline.run({
      message: arrival.message,
      records: input.records,
      llm: input.llm,
    });

    decisions.push(decision);
    input.onArrival?.({
      done: decisions.length,
      total: input.arrivals.length,
      messageId: arrival.messageId,
      caseId: arrival.caseId,
      llmCalls: decision.llmCalls,
    });
  }

  const pending: Pending[] = input.arrivals.map((arrival, index) => {
    const decision = decisions[index];
    if (decision === undefined) {
      throw new Error(`sim: no decision was recorded for ${arrival.messageId}`);
    }

    return {
      messageId: arrival.messageId,
      caseId: arrival.caseId,
      arrivedAtMs: Date.parse(arrival.arrivedAt),
      priority: decision.priority,
      queued: decision.route === 'human_review',
    };
  });

  const walk = walkQueue({
    operator: input.operator,
    arrivals: pending,
    windowMinutes: input.windowMinutes,
  });

  const openings = new Map(walk.openings.map((opening) => [opening.messageId, opening]));

  const played = input.arrivals.map((arrival, index): PlayedArrival => {
    const decision = decisions[index];
    const entry = pending[index];
    if (decision === undefined || entry === undefined) {
      throw new Error(`sim: no decision was recorded for ${arrival.messageId}`);
    }

    const opening = openings.get(arrival.messageId);
    const openedAtMs = opening?.openedAtMs ?? null;

    const interimMs = entry.queued
      ? interimAt({
          arrivedAtMs: entry.arrivedAtMs,
          openedAtMs,
          horizonMs: walk.horizonMs,
        })
      : null;

    return {
      messageId: arrival.messageId,
      caseId: arrival.caseId,
      subset: arrival.subset,
      critical: arrival.critical,
      arrivedAt: arrival.arrivedAt,
      decision,
      openedAt: openedAtMs === null ? null : new Date(openedAtMs).toISOString(),
      waitedWorkingMinutes: opening?.waitedWorkingMinutes ?? null,
      interimAt: interimMs === null ? null : new Date(interimMs).toISOString(),
    };
  });

  return {
    pipeline: input.pipeline.name,
    scenario: input.scenario,
    operator: input.operator,
    played,
    startedAt: new Date(walk.startedAtMs).toISOString(),
    horizonAt: new Date(walk.horizonMs).toISOString(),
    windowMinutes: input.windowMinutes,
  };
}
