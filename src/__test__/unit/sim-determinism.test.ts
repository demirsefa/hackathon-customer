/**
 * The same commit and the same scenario produce the same bytes, on both lines.
 *
 * This is the one check in `unit/` that opens the committed files. Determinism is a
 * property of a whole run and cannot be seen one module at a time: `walkQueue` being
 * pure says nothing about whether the scenario, the case set and the recorded responses
 * still line up. The number this project publishes comes out of exactly this path, and
 * a judge re-running it a week later has to get the same figure back.
 *
 * Both lines, not just `baseline`: the published figure is the `advanced` one, and its
 * cache keys — a classification and a draft per arrival — are different keys from the
 * ones `baseline` asks for. Replaying only `baseline` proved the cache answered a run
 * nobody quotes.
 *
 * What it does **not** do is re-render the trajectory committed beside it and compare
 * the whole file. That file names the commit it was produced at, so it changes on a
 * later regeneration by design — and `dev/contracts/SUBMISSION.md`'s own check rewrites
 * and restores it while this suite is running. Its `coverage` block is a different
 * matter: those numbers are the claim the submission makes, they do not move when the
 * provenance line does, and comparing them is what ties the published figure to the
 * code that is running now.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseCaseFile } from '../../core/cases.ts';
import { PIPELINES, type Pipeline } from '../../core/pipeline.ts';
import { CRITICAL_COVERAGE_MINUTES } from '../../core/policy.ts';
import { createRecordStore } from '../../core/records.ts';
import { parseScenario, resolveArrivals } from '../../core/scenario.ts';
import { PINNED_PARAMS } from '../../llm/key.ts';
import { readCache, replayClient } from '../../llm/replay.ts';
import { playScenario } from '../../sim/play.ts';
import { reportLines } from '../../sim/report.ts';
import { buildRecord, parseRecord, recordFile } from '../../sim/record.ts';
import { scoreTimeline } from '../../sim/score.ts';
import { renderTrajectory } from '../../sim/trajectory.ts';
import { SCENARIOS } from '../../cli/ask.ts';

const repoRoot = new URL('../../../', import.meta.url);

const readText = (path: string): string => readFileSync(new URL(path, repoRoot), 'utf8');

const read = (path: string): unknown => JSON.parse(readText(path));

const caseFile = parseCaseFile(read('fixtures/cases.json'));
const records = createRecordStore(caseFile);
const llm = replayClient({ cache: readCache(), params: PINNED_PARAMS });

const playOnce = async (pipeline: Pipeline, name: string) => {
  const scenario = parseScenario(read(`scenarios/${name}.json`));

  return playScenario({
    pipeline,
    scenario: scenario.name,
    operator: scenario.operator,
    arrivals: resolveArrivals({ scenario, cases: caseFile.cases }),
    records,
    llm,
    windowMinutes: CRITICAL_COVERAGE_MINUTES,
  });
};

/** Every line over every scenario — the same rule dev/contracts/FEATURE-PARITY.md §4 states. */
const RUNS = PIPELINES.flatMap((pipeline) =>
  SCENARIOS.map((scenario) => ({ pipeline, scenario })),
);

describe.each(RUNS)('$pipeline.name on $scenario, played twice in one process', (run) => {
  const { pipeline, scenario } = run;

  it('produces an identical timeline, byte for byte in every rendering of it', async () => {
    // One after the other, not concurrently: the player takes its messages one at a
    // time, and a check on it should not be the only place in the project that does not.
    const first = await playOnce(pipeline, scenario);
    const second = await playOnce(pipeline, scenario);

    expect(second).toEqual(first);
    expect(scoreTimeline(second)).toEqual(scoreTimeline(first));
    expect(reportLines(scoreTimeline(second))).toEqual(reportLines(scoreTimeline(first)));

    const render = (timeline: typeof first): string =>
      renderTrajectory(
        buildRecord({
          timeline,
          coverage: scoreTimeline(timeline),
          commit: 'fixed',
          llmLabel: 'replay',
          params: PINNED_PARAMS,
        }),
      );

    expect(render(second)).toBe(render(first));
  });

  /**
   * Sixty-four recordings answer both lines over every arrival of either scenario —
   * ninety of them in `overload` — which is only true because a repeat keeps the case's
   * text and a prompt is built from the text alone.
   * A miss here means the run a judge gets and the run that was recorded are not the
   * same run — and `replayClient` refuses rather than inventing an answer, so this
   * whole file goes red before a number is printed.
   *
   * What proves the cache answered is the coverage it produced, read out of the
   * committed trajectory rather than typed here: a number copied into a test is a third
   * source of truth, and the two that disagree with it would both look right.
   */
  it('answers every arrival out of the committed cache, reaching the published coverage', async () => {
    const timeline = await playOnce(pipeline, scenario);
    const coverage = scoreTimeline(timeline);

    expect(timeline.played).not.toHaveLength(0);

    const committed = parseRecord(
      readText(`trajectories/${recordFile(pipeline.name, scenario)}`),
    );

    expect({
      critical: coverage.critical,
      criticalReached: coverage.criticalReached,
    }).toEqual({
      critical: committed.coverage.critical,
      criticalReached: committed.coverage.criticalReached,
    });
  });
});
