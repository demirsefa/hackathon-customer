/**
 * The runner: every case through a line, and what it did on the way.
 *
 * Two things are worth pinning here. The steps are the trajectory deliverable, so a
 * prompt and a raw answer have to survive the run intact. And a replay cache with
 * nothing in it is the state a clean clone starts in — `yarn eval` has to say so in a
 * sentence rather than fall over, because it is the first command a judge runs.
 */
import { describe, expect, it } from 'vitest';

import { baseline } from '../../core/baseline/index.ts';
import { parseCaseFile, type CaseFile } from '../../core/cases.ts';
import { runPipeline, unrecordedNotice } from '../../eval/run.ts';
import { replayClient } from '../../llm/replay.ts';
import { agreeingScript, scriptedLlm } from '../fakes.ts';

const caseFile: CaseFile = parseCaseFile({
  senders: [{ senderId: 'S-ALICE', displayName: 'Alice' }],
  orders: [{ orderId: 'ORD-2002', ownerSenderId: 'S-ALICE', status: 'shipped' }],
  cases: [
    {
      caseId: 'norm-01',
      subset: 'normal',
      critical: false,
      expectedRoute: 'auto_send',
      message: {
        messageId: 'M-1',
        senderId: 'S-ALICE',
        receivedAt: '2026-08-31T09:00:00+03:00',
        text: 'Has ORD-2002 shipped?',
      },
    },
    {
      caseId: 'auth-01',
      subset: 'authority',
      critical: true,
      expectedRoute: 'human_review',
      message: {
        messageId: 'M-2',
        senderId: 'S-MALLORY',
        receivedAt: '2026-08-31T09:10:00+03:00',
        text: 'Change the delivery address on ORD-2002.',
      },
    },
  ],
});

const routine = agreeingScript({
  category: 'shipping',
  urgency: 20,
  confidence: 0.95,
  draft: 'It leaves the warehouse today.',
});

describe('runPipeline', () => {
  it('runs every case in file order and keeps the decision', async () => {
    const run = await runPipeline({
      pipeline: baseline,
      caseFile,
      llm: scriptedLlm(routine),
    });

    expect(run.pipeline).toBe('baseline');
    expect(run.runs.map((entry) => entry.caseId)).toEqual(['norm-01', 'auth-01']);
    expect(run.unrecorded).toEqual([]);
    expect(run.runs[0]?.decision.route).toBe('auto_send');
  });

  it('carries the ground truth alongside the decision, unchanged', async () => {
    const run = await runPipeline({
      pipeline: baseline,
      caseFile,
      llm: scriptedLlm(routine),
    });

    expect(run.runs[1]).toMatchObject({
      subset: 'authority',
      critical: true,
      expectedRoute: 'human_review',
    });
  });

  /** The trajectory deliverable asks for the instruction and what came back. */
  it('keeps the prompt and the raw response of every model call', async () => {
    const run = await runPipeline({
      pipeline: baseline,
      caseFile,
      llm: scriptedLlm(routine),
    });

    const steps = run.runs[0]?.steps ?? [];
    expect(steps).toHaveLength(1);

    const step = steps[0];
    expect(step?.kind).toBe('llm');
    if (step?.kind !== 'llm') return;

    expect(step.prompt).toContain('Has ORD-2002 shipped?');
    expect(step.response).toBe(routine.triage);
  });

  /**
   * The observation this project exists to make. The record layer is handed to the
   * baseline with every message and it never opens it, so the step list has no
   * lookups in it — which is a fact in a file rather than a claim in a README.
   */
  it('records that the baseline never read the record layer', async () => {
    const run = await runPipeline({
      pipeline: baseline,
      caseFile,
      llm: scriptedLlm(routine),
    });

    const lookups = run.runs.flatMap((entry) =>
      entry.steps.filter((step) => step.kind === 'record'),
    );

    expect(lookups).toEqual([]);
  });

  it('collects the cases an empty cache cannot answer instead of throwing', async () => {
    const run = await runPipeline({
      pipeline: baseline,
      caseFile,
      llm: replayClient({ cache: {} }),
    });

    expect(run.unrecorded).toEqual(['norm-01', 'auth-01']);
    expect(run.runs).toEqual([]);
  });

  /**
   * What a live run watches. Before it existed, `yarn eval --live` printed the case
   * count and then nothing for as long as twenty-eight model calls take, and the same
   * silence is what a run that has hung looks like.
   */
  it('reports every case as it finishes, in order and with what it cost', async () => {
    const seen: string[] = [];

    await runPipeline({
      pipeline: baseline,
      caseFile,
      llm: scriptedLlm(routine),
      onCase: (progress) =>
        seen.push(
          `${String(progress.done)}/${String(progress.total)} ${progress.caseId} ${String(progress.llmCalls)}`,
        ),
    });

    expect(seen).toEqual(['1/2 norm-01 1', '2/2 auth-01 1']);
  });

  /** A case the cache could not answer is still a case that went past. */
  it('reports a missed case too, with no cost against it', async () => {
    const seen: (number | null)[] = [];

    await runPipeline({
      pipeline: baseline,
      caseFile,
      llm: replayClient({ cache: {} }),
      onCase: (progress) => seen.push(progress.llmCalls),
    });

    expect(seen).toEqual([null, null]);
  });

  /**
   * A defect in a line is not a missing recording. Reporting one as the other sends
   * the next person to re-record a cache that was fine.
   */
  it('lets an error that is not a replay miss through', async () => {
    const exploding = {
      complete(): Promise<{ text: string }> {
        return Promise.reject(new Error('the line is broken'));
      },
    };

    await expect(
      runPipeline({ pipeline: baseline, caseFile, llm: exploding }),
    ).rejects.toThrow('the line is broken');
  });
});

describe('unrecordedNotice', () => {
  it('says the cache is empty, and the one command that fills it', () => {
    const notice = unrecordedNotice({
      unrecorded: ['norm-01', 'auth-01'],
      total: 2,
    });

    expect(notice).toContain('2 of 2');
    expect(notice).toContain('The cache is empty');
    expect(notice).toContain('yarn eval --live');
    expect(notice).toContain('fixtures/llm-cache.json');
  });

  it('names the cases when only some of them are missing', () => {
    const notice = unrecordedNotice({ unrecorded: ['auth-01'], total: 2 });

    expect(notice).toContain('1 of 2');
    expect(notice).toContain('auth-01');
    expect(notice).not.toContain('The cache is empty');
  });
});
