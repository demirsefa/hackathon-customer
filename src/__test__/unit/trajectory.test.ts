/**
 * The trajectory file, checked as a deliverable rather than as a string.
 *
 * dev/CHALLENGE.md §4 deliverable 4 asks for the instructions given, what each tool
 * returned, the decision, and every human checkpoint. §13 names the human checkpoint
 * as one of the two things most often left out. So the assertions here are about
 * whether a judge reading the file can see those things, not about its wording.
 */
import { describe, expect, it } from 'vitest';

import type { CaseSubset } from '../../core/cases.ts';
import { autoSend, humanReview, type Decision, type Route } from '../../core/decision.ts';
import { buildRecord } from '../../eval/record.ts';
import type { CaseRun } from '../../eval/run.ts';
import { scoreRun } from '../../eval/score.ts';
import {
  renderTrajectory,
  representatives,
  trajectoryFile,
} from '../../eval/trajectory.ts';
import { PINNED_PARAMS } from '../../llm/key.ts';

function caseRun(input: {
  readonly caseId: string;
  readonly subset: CaseSubset;
  readonly expectedRoute: Route;
  readonly decision: Decision;
  readonly text?: string;
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
      text: input.text ?? 'Where is ORD-2002?',
    },
    decision: input.decision,
    steps: [
      {
        kind: 'llm',
        prompt: 'TASK: triage\n\nMESSAGE:\nWhere is ORD-2002?',
        response: '{"category":"shipping","urgency":20,"draft":"On its way."}',
      },
    ],
  };
}

const sent = (caseId: string, subset: CaseSubset, expectedRoute: Route): CaseRun =>
  caseRun({
    caseId,
    subset,
    expectedRoute,
    decision: autoSend({ messageId: caseId, draft: 'On its way.', llmCalls: 1 }),
  });

const heldCase = (caseId: string, subset: CaseSubset, expectedRoute: Route): CaseRun =>
  caseRun({
    caseId,
    subset,
    expectedRoute,
    decision: humanReview({
      messageId: caseId,
      reason: 'sensitive_category',
      draft: 'I have started your refund.',
      priority: 73,
      llmCalls: 1,
    }),
  });

function render(runs: readonly CaseRun[]): string {
  return renderTrajectory(
    buildRecord({
      run: { pipeline: 'baseline', runs, unrecorded: [] },
      scorecard: scoreRun({ pipeline: 'baseline', outcomes: runs }),
      commit: 'abc1234',
      llmLabel: 'replay (claude-sonnet-5) — 28 recorded response(s)',
      params: PINNED_PARAMS,
    }),
  );
}

describe('trajectoryFile', () => {
  /** dev/contracts/SUBMISSION.md rule 4 looks for a file carrying the line's name. */
  it('names the file after the line', () => {
    expect(trajectoryFile('baseline')).toBe('baseline.md');
  });
});

describe('representatives', () => {
  const runs = [
    sent('norm-01', 'normal', 'auto_send'),
    heldCase('norm-04', 'normal', 'human_review'),
    heldCase('inj-01', 'injection', 'human_review'),
    sent('inj-04', 'injection', 'human_review'),
    sent('auth-01', 'authority', 'human_review'),
    heldCase('amb-02', 'ambiguous', 'human_review'),
  ];

  it('shows one case per subset, in the order of CHALLENGE §10', () => {
    expect(representatives(runs).map((run) => run.caseId)).toEqual([
      // normal: the case that went right, so the file shows how the line works.
      'norm-01',
      // the rest: the missed hold, which is where the design is.
      'inj-04',
      'auth-01',
      'amb-02',
    ]);
  });

  it('falls back to the first case of a subset that has nothing to show', () => {
    const noMisses = [
      sent('norm-01', 'normal', 'auto_send'),
      heldCase('inj-01', 'injection', 'human_review'),
    ];

    expect(representatives(noMisses).map((run) => run.caseId)).toEqual([
      'norm-01',
      'inj-01',
    ]);
  });

  /**
   * The human checkpoint is a rubric row of its own, and a line that misses every
   * hold in three subsets would otherwise produce a file with no queued case in it.
   */
  it('adds a held case when every case it picked was auto-sent', () => {
    const chosen = representatives([
      sent('norm-01', 'normal', 'auto_send'),
      heldCase('norm-04', 'normal', 'human_review'),
      sent('inj-04', 'injection', 'human_review'),
    ]);

    expect(chosen.map((run) => run.caseId)).toEqual(['norm-01', 'inj-04', 'norm-04']);
  });
});

describe('renderTrajectory', () => {
  const document = render([
    sent('norm-01', 'normal', 'auto_send'),
    sent('auth-01', 'authority', 'human_review'),
    heldCase('amb-02', 'ambiguous', 'human_review'),
  ]);

  it('states which code and which model produced the numbers', () => {
    expect(document).toContain('abc1234');
    expect(document).toContain(PINNED_PARAMS.model);
    expect(document).toContain('replay (claude-sonnet-5)');
  });

  it('carries the scores, missed holds named', () => {
    expect(document).toContain('Routing accuracy | 2 / 3');
    expect(document).toContain('`auth-01`');
  });

  it('shows the instruction sent and the raw answer that came back', () => {
    expect(document).toContain('TASK: triage');
    expect(document).toContain(
      '{"category":"shipping","urgency":20,"draft":"On its way."}',
    );
  });

  it('marks the human decision point on a held case, and says nothing was sent', () => {
    expect(document).toContain('HUMAN DECISION POINT');
    expect(document).toMatch(/Nothing was sent to the customer/);
  });

  it('says plainly when a reply went out with no human in the loop', () => {
    expect(document).toContain('No human checkpoint.');
  });

  it('records that the record layer was handed over and never opened', () => {
    expect(document).toContain('never opened — 0 lookups');
  });

  it('reports a record lookup and what it returned', () => {
    const withLookup: CaseRun = {
      ...sent('auth-01', 'authority', 'human_review'),
      steps: [
        {
          kind: 'record',
          lookup: 'findOrder("ORD-2002")',
          found: 'ORD-2002, owned by S-ALICE, status shipped',
        },
      ],
    };

    const text = render([withLookup]);
    expect(text).toContain('findOrder("ORD-2002")');
    expect(text).toContain('owned by S-ALICE');
  });

  /**
   * Model output is untrusted text. A fence its payload can close would turn the rest
   * of the deliverable into markup.
   */
  it('fences a response that contains a fence of its own', () => {
    const backticked: CaseRun = {
      ...sent('norm-01', 'normal', 'auto_send'),
      steps: [
        {
          kind: 'llm',
          prompt: 'TASK: triage',
          response: '```json\n{"category":"shipping"}\n```',
        },
      ],
    };

    expect(render([backticked])).toContain('````text');
  });
});
