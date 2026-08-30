/**
 * The raw half of the evaluation deliverable — `trajectories/<line>.json`.
 *
 * One claim is worth a test here, and it is the claim the JSON exists to support: the
 * markdown beside it is a **view** of this document, not a second, independently
 * written account of the same run. The entry point renders from the parsed
 * serialisation, so anything the renderer reaches for that does not survive
 * `JSON.stringify` takes its line of the document with it. That is asserted below
 * rather than trusted, because it is the kind of thing a later edit breaks silently.
 */
import { describe, expect, it } from 'vitest';

import type { CaseSubset } from '../../core/cases.ts';
import { autoSend, humanReview, type Decision, type Route } from '../../core/decision.ts';
import {
  buildRecord,
  EVAL_SCHEMA,
  parseRecord,
  recordFile,
  serialiseRecord,
} from '../../eval/record.ts';
import type { CaseRun } from '../../eval/run.ts';
import { scoreRun } from '../../eval/score.ts';
import { renderTrajectory } from '../../eval/trajectory.ts';
import { PINNED_PARAMS } from '../../llm/key.ts';

function caseRun(input: {
  readonly caseId: string;
  readonly subset: CaseSubset;
  readonly expectedRoute: Route;
  readonly decision: Decision;
}): CaseRun {
  return {
    caseId: input.caseId,
    subset: input.subset,
    critical: input.expectedRoute === 'human_review',
    expectedRoute: input.expectedRoute,
    message: {
      messageId: `M-${input.caseId}`,
      senderId: 'S-ALICE',
      receivedAt: '2026-08-31T09:00:00+03:00',
      text: 'Where is ORD-2002?',
    },
    decision: input.decision,
    steps: [
      {
        kind: 'llm',
        prompt: 'TASK: triage\n\nMESSAGE:\nWhere is ORD-2002?',
        response: '{"category":"shipping","urgency":20,"draft":"On its way."}',
      },
      { kind: 'record', lookup: 'ORD-2002', found: null },
    ],
  };
}

const RUNS: readonly CaseRun[] = [
  caseRun({
    caseId: 'norm-01',
    subset: 'normal',
    expectedRoute: 'auto_send',
    decision: autoSend({ messageId: 'norm-01', draft: 'On its way.', llmCalls: 1 }),
  }),
  caseRun({
    caseId: 'inj-01',
    subset: 'injection',
    expectedRoute: 'human_review',
    decision: autoSend({ messageId: 'inj-01', draft: 'Refund issued.', llmCalls: 1 }),
  }),
  caseRun({
    caseId: 'auth-01',
    subset: 'authority',
    expectedRoute: 'human_review',
    decision: humanReview({
      messageId: 'auth-01',
      reason: 'sensitive_category',
      draft: 'Looking into it.',
      priority: 73,
      llmCalls: 1,
    }),
  }),
];

const record = (): ReturnType<typeof buildRecord> =>
  buildRecord({
    run: { pipeline: 'baseline', runs: RUNS, unrecorded: [] },
    scorecard: scoreRun({ pipeline: 'baseline', outcomes: RUNS }),
    commit: 'abc1234',
    llmLabel: 'replay (claude-sonnet-5) — 28 recorded response(s)',
    params: PINNED_PARAMS,
  });

describe('recordFile', () => {
  it('sits beside the markdown, under the same name', () => {
    expect(recordFile('baseline')).toBe('baseline.json');
  });
});

describe('the record a judge can recompute from', () => {
  it('states its schema, so a consumer never has to guess from the shape', () => {
    expect(record().schema).toBe(EVAL_SCHEMA);
  });

  it('names the code, the model and the files the numbers came from', () => {
    const { provenance } = record();

    expect(provenance.commit).toBe('abc1234');
    expect(provenance.params).toEqual(PINNED_PARAMS);
    expect(provenance.inputs.cases).toBe('fixtures/cases.json');
    expect(provenance.inputs.cache).toBe('fixtures/llm-cache.json');
    // The command is in the file so the file says how to reproduce itself.
    expect(provenance.command).toBe('yarn eval --replay');
  });

  it('carries every case, not the handful the markdown shows', () => {
    expect(record().run.runs).toHaveLength(RUNS.length);
    expect(record().run.runs.map((run) => run.caseId)).toEqual([
      'norm-01',
      'inj-01',
      'auth-01',
    ]);
  });

  it('carries the prompts and raw answers, which is what makes it raw', () => {
    const steps = record().run.runs[0]?.steps ?? [];
    expect(steps).toContainEqual({
      kind: 'llm',
      prompt: 'TASK: triage\n\nMESSAGE:\nWhere is ORD-2002?',
      response: '{"category":"shipping","urgency":20,"draft":"On its way."}',
    });
  });

  it('holds the figures the markdown quotes, so both can never disagree', () => {
    const { scorecard } = record();

    expect(scorecard.cases).toBe(3);
    expect(scorecard.missedHolds).toEqual(['inj-01']);
    expect(renderTrajectory(record())).toContain(`${String(scorecard.cases)}`);
  });
});

describe('the markdown is a view of the JSON', () => {
  /**
   * The property the whole arrangement rests on. Render from the object in hand and
   * render from its round trip through text: a difference means the document is
   * carrying something the file does not, and the file is the deliverable.
   */
  it('renders identically from the object and from its serialisation', () => {
    const original = record();
    const roundTripped = parseRecord(serialiseRecord(original));

    expect(roundTripped).toEqual(original);
    expect(renderTrajectory(roundTripped)).toBe(renderTrajectory(original));
  });

  it('serialises to a stable document — same run in, same bytes out', () => {
    expect(serialiseRecord(record())).toBe(serialiseRecord(record()));
  });

  it('ends in a newline, so a diff never reports a no-newline-at-end-of-file', () => {
    expect(serialiseRecord(record()).endsWith('}\n')).toBe(true);
  });
});

describe('parseRecord', () => {
  it('refuses a document written against another schema', () => {
    const wrong = serialiseRecord(record()).replace(EVAL_SCHEMA, 'something/else@9');
    expect(() => parseRecord(wrong)).toThrow(/schema is/);
  });

  it('refuses anything that is not an object', () => {
    expect(() => parseRecord('[]')).toThrow(/expected a JSON object/);
  });
});
