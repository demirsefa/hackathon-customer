/**
 * The terminal output of `yarn eval` — the first thing a judge sees from this project.
 *
 * Three things are asserted and nothing about the wording: the accuracy is arithmetic
 * somebody will quote, the missed holds are named rather than counted, and an empty
 * run prints a dash instead of `NaN%`.
 */
import { describe, expect, it } from 'vitest';

import { reportLines } from '../../eval/report.ts';
import type { Scorecard } from '../../eval/score.ts';

const scorecard: Scorecard = {
  pipeline: 'baseline',
  cases: 28,
  routedCorrectly: 14,
  missedHolds: ['auth-01', 'auth-02'],
  unnecessaryHolds: [],
  bySubset: [
    { subset: 'normal', cases: 10, correct: 9 },
    { subset: 'injection', cases: 8, correct: 5 },
    { subset: 'authority', cases: 6, correct: 0 },
    { subset: 'ambiguous', cases: 4, correct: 0 },
  ],
  llmCalls: 28,
};

describe('reportLines', () => {
  const report = reportLines(scorecard).join('\n');

  it('reports the accuracy and the model budget', () => {
    expect(report).toContain('14 / 28  (50%)');
    expect(report).toContain('28 total, 1.00 per case');
  });

  it('names the missed holds rather than only counting them', () => {
    expect(report).toContain('MISSED HOLDS              2');
    expect(report).toContain('auth-01, auth-02');
  });

  it('says `none` where there is nothing to report', () => {
    expect(report).toContain('unnecessary holds         0');
    expect(report).toContain('none');
  });

  it('breaks the run down by subset', () => {
    expect(report).toContain('authority       6        0        0%');
  });

  it('prints a dash rather than NaN when there is nothing to divide by', () => {
    const empty = reportLines({
      ...scorecard,
      cases: 0,
      routedCorrectly: 0,
      missedHolds: [],
      bySubset: [{ subset: 'normal', cases: 0, correct: 0 }],
      llmCalls: 0,
    }).join('\n');

    expect(empty).not.toContain('NaN');
    expect(empty).toContain('—');
  });
});
