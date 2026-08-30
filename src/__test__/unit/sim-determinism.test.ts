/**
 * The same commit and the same scenario produce the same bytes.
 *
 * This is the one check in `unit/` that opens the committed files. Determinism is a
 * property of a whole run and cannot be seen one module at a time: `walkQueue` being
 * pure says nothing about whether the scenario, the case set and the recorded responses
 * still line up. The number this project publishes comes out of exactly this path, and
 * a judge re-running it a week later has to get the same figure back.
 *
 * What it does **not** do is compare against the trajectory committed beside it. That
 * file names the commit it was produced at, so it changes on a later regeneration by
 * design — and `dev/contracts/SUBMISSION.md`'s own check rewrites and restores it while
 * this suite is running.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseCaseFile } from '../../core/cases.ts';
import { baseline } from '../../core/baseline/index.ts';
import { CRITICAL_COVERAGE_MINUTES } from '../../core/policy.ts';
import { createRecordStore } from '../../core/records.ts';
import { parseScenario, resolveArrivals } from '../../core/scenario.ts';
import { PINNED_PARAMS } from '../../llm/key.ts';
import { readCache, replayClient } from '../../llm/replay.ts';
import { playScenario } from '../../sim/play.ts';
import { reportLines } from '../../sim/report.ts';
import { buildRecord } from '../../sim/record.ts';
import { scoreTimeline } from '../../sim/score.ts';
import { renderTrajectory } from '../../sim/trajectory.ts';
import { SCENARIOS } from '../../cli/ask.ts';

const repoRoot = new URL('../../../', import.meta.url);

const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, repoRoot), 'utf8'));

const caseFile = parseCaseFile(read('fixtures/cases.json'));
const records = createRecordStore(caseFile);
const llm = replayClient({ cache: readCache(), params: PINNED_PARAMS });

const playOnce = async (name: string) => {
  const scenario = parseScenario(read(`scenarios/${name}.json`));

  return playScenario({
    pipeline: baseline,
    scenario: scenario.name,
    operator: scenario.operator,
    arrivals: resolveArrivals({ scenario, cases: caseFile.cases }),
    records,
    llm,
    windowMinutes: CRITICAL_COVERAGE_MINUTES,
  });
};

describe.each(SCENARIOS)('%s, played twice in one process', (name) => {
  it('produces an identical timeline, byte for byte in every rendering of it', async () => {
    // One after the other, not concurrently: the player takes its messages one at a
    // time, and a check on it should not be the only place in the project that does not.
    const first = await playOnce(name);
    const second = await playOnce(name);

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
   * Twenty-eight recordings covering ninety arrivals, which is only true because a
   * repeat keeps the case's text and a prompt is built from the text alone. A miss here
   * means the run a judge gets and the run that was recorded are not the same run.
   */
  it('answers every arrival out of the committed cache, with nothing live', async () => {
    const timeline = await playOnce(name);

    expect(timeline.played).not.toHaveLength(0);
    expect(timeline.played.every((arrival) => arrival.decision.llmCalls === 1)).toBe(
      true,
    );
  });
});
