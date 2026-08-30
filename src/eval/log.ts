/**
 * The evaluation case by case, on every run.
 *
 * The scorecard beside this one is a count of what went right and a list of ids for
 * what went wrong. That is the right shape for a result and the wrong shape for the
 * question a developer actually has, which is *which* case, expected what, got what,
 * and at what cost. So this prints one line per case, in the order the case file lists
 * them, and marks the two errors apart — because they are not the same error and they
 * do not cost the same thing.
 *
 * **This is the verdict list, and it belongs here.** `src/sim/` has no ground truth in
 * front of it: a scenario plays a case ninety times over a clock, and the only question
 * there is whether the operator reached it in time. Printing a per-case right-or-wrong
 * beside a coverage number would answer a question that run never asked.
 *
 * Pure. It returns lines and never writes them; the entry point puts them on
 * **stderr**, so the scorecard on stdout is untouched.
 *
 * The `Paint` it is handed decides nothing about the words: given none it produces the
 * plain text the checks assert on, and given the terminal's it faints the heading and
 * reddens the missed holds. The rule about when a destination may take an escape at
 * all is `src/cli/paint.ts`'s.
 */
import { PLAIN, type Paint } from '../cli/paint.ts';
import type { Route } from '../core/decision.ts';
import type { CaseRun, PipelineRun } from './run.ts';

/**
 * What the case did, in the vocabulary the scorecard already uses.
 *
 * `MISSED HOLD` is upper case for the reason it is upper case there: it is a reply that
 * reached a customer without being read, and it must not look like the row above it.
 */
type Verdict = 'ok' | 'MISSED HOLD' | 'extra hold';

const verdictOf = (run: CaseRun): Verdict => {
  if (run.decision.route === run.expectedRoute) return 'ok';
  return run.expectedRoute === 'human_review' ? 'MISSED HOLD' : 'extra hold';
};

/** `human_review` and `auto_send` are 12 and 9 characters; the arrow has to line up. */
const routes = (expected: Route, actual: Route): string =>
  `${expected.padEnd(12)} → ${actual.padEnd(12)}`;

const plural = (count: number, noun: string): string =>
  `${String(count)} ${noun}${count === 1 ? '' : 's'}`;

function caseLine(run: CaseRun, paint: Paint): string {
  const verdict = verdictOf(run);

  // Painted at its full width rather than padded afterwards: an escape sequence counts
  // towards `padEnd`, and every column after it would move on exactly the rows that
  // must line up with the ones above them.
  const marker =
    verdict === 'MISSED HOLD'
      ? paint.alarm(verdict)
      : verdict.padEnd('MISSED HOLD'.length);

  return [
    `  ${marker}`,
    run.caseId.padEnd(9),
    run.subset.padEnd(10),
    routes(run.expectedRoute, run.decision.route),
    `p${String(run.decision.priority).padStart(2)}`,
    run.decision.reason.padEnd(22),
    plural(run.decision.llmCalls, 'call').padEnd(7),
    run.critical ? 'critical' : '',
  ]
    .join('  ')
    .trimEnd();
}

/**
 * One line per case, wrong ones legible at a glance.
 *
 * A case with no recorded response produced no decision at all and has no row: it is
 * not a wrong answer, it is a missing one, and `unrecordedNotice` is what says so.
 */
export function caseLog(run: PipelineRun, paint: Paint = PLAIN): readonly string[] {
  return [
    // The heading and its legend are the frame around the rows, so they are faint
    // where a terminal can make them faint.
    paint.dim(`${run.pipeline} — case by case`),
    paint.dim(
      `  ${plural(run.runs.length, 'case')} decided, expected route → the route the line took`,
    ),
    '',
    ...run.runs.map((one) => caseLine(one, paint)),
    '',
  ];
}
