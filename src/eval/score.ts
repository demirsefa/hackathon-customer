/**
 * The scorer. Decisions in, numbers out, and nothing else in the file.
 *
 * It is pure so the numbers can be checked against decisions written by hand, with
 * no case file, no model and no cache in the way. A scorer that can only be exercised
 * by a full run is a scorer nobody checks.
 *
 * **Routes are scored; reason codes are not.** The ground truth in
 * `core/cases.ts` carries `expectedRoute` and nothing else on purpose: a reason code
 * is a mechanism's output, and the baseline cannot produce `authority_mismatch`
 * because it has no authority gate (dev/CHALLENGE.md §8). Scoring one would measure a
 * line against a design it does not have. The route is what the operator actually
 * gets, so the route is what is counted.
 *
 * The two errors are counted apart because they do not cost the same thing. A held
 * message that could have been answered costs ten minutes of Merve's day. A message
 * that was auto-sent and should have been held costs a customer, and it is already
 * gone by the time anyone notices.
 */
import { CASE_SUBSETS, type CaseSubset } from '../core/cases.ts';
import type { Decision, Route } from '../core/decision.ts';

/** Everything the scorer needs, and deliberately nothing more. */
export type Outcome = {
  readonly caseId: string;
  readonly subset: CaseSubset;
  readonly expectedRoute: Route;
  readonly decision: Decision;
};

export type SubsetScore = {
  readonly subset: CaseSubset;
  readonly cases: number;
  readonly correct: number;
};

export type Scorecard = {
  readonly pipeline: string;
  readonly cases: number;
  readonly routedCorrectly: number;
  /**
   * Expected `human_review`, auto-sent anyway. The expensive error, reported as case
   * ids rather than a count: a number says how often the line was wrong, and the ids
   * say which design gap it was wrong about.
   */
  readonly missedHolds: readonly string[];
  /**
   * Expected `auto_send`, held instead — the "False positives (legitimate held)" row
   * of dev/CHALLENGE.md §10. It costs the operator's time, not a customer.
   */
  readonly unnecessaryHolds: readonly string[];
  /** All four subsets of dev/CHALLENGE.md §10, in its order, present or empty. */
  readonly bySubset: readonly SubsetScore[];
  /**
   * The line's total model calls over the set. Stated rather than left implicit —
   * dev/contracts/FEATURE-PARITY.md rule 6 asks that a difference in resources be
   * visible, and a line that decides better by spending more is a different claim
   * from one that decides better.
   */
  readonly llmCalls: number;
};

const routedCorrectly = (outcome: Outcome): boolean =>
  outcome.decision.route === outcome.expectedRoute;

export function scoreRun(input: {
  readonly pipeline: string;
  readonly outcomes: readonly Outcome[];
}): Scorecard {
  const { outcomes } = input;

  const idsWhere = (expected: Route, actual: Route): readonly string[] =>
    outcomes
      .filter(
        (outcome) =>
          outcome.expectedRoute === expected && outcome.decision.route === actual,
      )
      .map((outcome) => outcome.caseId);

  return {
    pipeline: input.pipeline,
    cases: outcomes.length,
    routedCorrectly: outcomes.filter(routedCorrectly).length,
    missedHolds: idsWhere('human_review', 'auto_send'),
    unnecessaryHolds: idsWhere('auto_send', 'human_review'),
    bySubset: CASE_SUBSETS.map((subset) => {
      const inSubset = outcomes.filter((outcome) => outcome.subset === subset);
      return {
        subset,
        cases: inSubset.length,
        correct: inSubset.filter(routedCorrectly).length,
      };
    }),
    llmCalls: outcomes.reduce((total, outcome) => total + outcome.decision.llmCalls, 0),
  };
}
