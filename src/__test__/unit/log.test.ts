/**
 * The case-by-case block `yarn eval` prints.
 *
 * The scorecard says how many and which ids; this says what each case expected, what
 * it got, and what it cost. The one rule worth a check is the one the scorecard
 * follows too: the two errors are not the same error. A message auto-sent that should
 * have been held is already with a customer, and it may not read like the row above it.
 */
import { describe, expect, it } from 'vitest';

import { createPaint } from '../../cli/paint.ts';
import { autoSend, humanReview } from '../../core/decision.ts';
import type { Route } from '../../core/decision.ts';
import type { CaseSubset } from '../../core/cases.ts';
import { caseLog } from '../../eval/log.ts';
import type { CaseRun, PipelineRun } from '../../eval/run.ts';
import { stripColour } from '../fakes.ts';

const message = (caseId: string) => ({
  messageId: caseId,
  senderId: 'S-1',
  receivedAt: '2026-03-02T09:00:00+03:00',
  text: 'where is my order',
});

const decided = (input: {
  readonly caseId: string;
  readonly subset: CaseSubset;
  readonly expectedRoute: Route;
  readonly actual: Route;
  readonly critical?: boolean;
}): CaseRun => ({
  caseId: input.caseId,
  subset: input.subset,
  critical: input.critical ?? false,
  expectedRoute: input.expectedRoute,
  message: message(input.caseId),
  decision:
    input.actual === 'auto_send'
      ? autoSend({ messageId: input.caseId, draft: 'here you go', llmCalls: 1 })
      : humanReview({
          messageId: input.caseId,
          reason: 'authority_mismatch',
          llmCalls: 2,
        }),
  steps: [],
});

const RUN: PipelineRun = {
  pipeline: 'baseline',
  runs: [
    decided({
      caseId: 'norm-01',
      subset: 'normal',
      expectedRoute: 'auto_send',
      actual: 'auto_send',
    }),
    decided({
      caseId: 'auth-01',
      subset: 'authority',
      expectedRoute: 'human_review',
      actual: 'auto_send',
      critical: true,
    }),
    decided({
      caseId: 'norm-03',
      subset: 'normal',
      expectedRoute: 'auto_send',
      actual: 'human_review',
    }),
  ],
  unrecorded: [],
};

const lines = caseLog(RUN);
const text = lines.join('\n');
const rowFor = (caseId: string): string =>
  lines.find((line) => line.includes(caseId)) ?? '';

describe('caseLog', () => {
  it('names the line the rows belong to', () => {
    expect(lines[0]).toBe('baseline — case by case');
  });

  it('gives every decided case a row, in the order the case file lists them', () => {
    expect(rowFor('norm-01')).not.toBe('');
    expect(lines.indexOf(rowFor('auth-01'))).toBeLessThan(
      lines.indexOf(rowFor('norm-03')),
    );
  });

  it('shows what was expected beside what the line did', () => {
    expect(rowFor('auth-01')).toContain('human_review → auto_send');
  });

  it('shouts about a hold that was missed, and only about that one', () => {
    expect(rowFor('auth-01')).toContain('MISSED HOLD');
    expect(rowFor('norm-03')).toContain('extra hold');
    expect(rowFor('norm-01')).toContain('ok');
  });

  it('carries the reason and the cost, so a right answer bought twice is visible', () => {
    expect(rowFor('norm-03')).toContain('authority_mismatch');
    expect(rowFor('norm-03')).toContain('2 calls');
    expect(rowFor('norm-01')).toContain('1 call');
  });

  it('marks the critical ones, which are the ones the scenario run is measured on', () => {
    expect(rowFor('auth-01')).toContain('critical');
    expect(rowFor('norm-01')).not.toContain('critical');
  });

  it('writes plain text unless a painter says the destination takes colour', () => {
    expect(text).not.toContain('\u001b');
  });

  it('paints the missed hold, and leaves the columns where they were', () => {
    const painted = caseLog(RUN, createPaint({ colours: true }));
    const missed = painted.find((line) => line.includes('auth-01')) ?? '';

    expect(missed).toContain('\u001b[1;31mMISSED HOLD\u001b[0m');
    // Strip the escapes and the block is the one asserted above, column for column.
    expect(painted.map(stripColour)).toEqual(lines);
  });

  it('leaves a case with no recorded response out rather than scoring it', () => {
    const missing = caseLog({ ...RUN, runs: [], unrecorded: ['inj-01'] }).join('\n');

    expect(missing).not.toContain('inj-01');
    expect(text).toContain('3 cases decided');
  });
});
