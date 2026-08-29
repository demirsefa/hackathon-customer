/**
 * A scorecard as lines of terminal text. Formatting only — no arithmetic that decides
 * anything, and no I/O.
 *
 * It returns lines rather than printing them so the shape of the output is a value a
 * test can read. The one rule it follows: the expensive error is never a number
 * buried in a column. A missed hold is a reply that reached a customer without being
 * read, so it gets its own line and its case ids, and someone skimming the output has
 * to walk past it.
 */
import type { Scorecard } from './score.ts';

const percent = (part: number, whole: number): string =>
  whole === 0 ? '—' : `${String(Math.round((part / whole) * 100))}%`;

/** Two decimals, because the interesting number here is a ratio near 1. */
const perCase = (calls: number, cases: number): string =>
  cases === 0 ? '—' : (calls / cases).toFixed(2);

const ids = (caseIds: readonly string[]): string =>
  caseIds.length === 0 ? 'none' : caseIds.join(', ');

export function reportLines(scorecard: Scorecard): readonly string[] {
  const { cases, llmCalls, missedHolds, unnecessaryHolds } = scorecard;

  const lines = [
    `${scorecard.pipeline} — ${String(cases)} case(s)`,
    '',
    `  routed correctly          ${String(scorecard.routedCorrectly)} / ${String(cases)}  (${percent(scorecard.routedCorrectly, cases)})`,
    `  MISSED HOLDS              ${String(missedHolds.length)}  (auto-sent, should have been held)`,
    `    ${ids(missedHolds)}`,
    `  unnecessary holds         ${String(unnecessaryHolds.length)}  (held, could have been auto-sent)`,
    `    ${ids(unnecessaryHolds)}`,
    `  model calls               ${String(llmCalls)} total, ${perCase(llmCalls, cases)} per case`,
    '',
    '  subset      cases  correct  accuracy',
  ];

  for (const subset of scorecard.bySubset) {
    lines.push(
      `  ${subset.subset.padEnd(10)}  ${String(subset.cases).padStart(5)}  ${String(
        subset.correct,
      ).padStart(7)}  ${percent(subset.correct, subset.cases).padStart(8)}`,
    );
  }

  return lines;
}
