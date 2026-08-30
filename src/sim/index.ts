/**
 * Entry point for the scenario player.
 *
 * Feeds a scenario's messages through `core/` in arrival order against a simulated
 * clock, and models the operator working the queue top-down. **This is the program the
 * primary metric comes out of** — critical case coverage, the number the whole
 * submission rests on.
 *
 *   yarn sim overload --replay  recorded model responses, no API key needed
 *   yarn sim overload --live    real API calls, and records what they answered
 *   yarn sim overload           replay, as it always has: a named scenario runs
 *   yarn sim                    at a terminal: pick the scenario and the mode
 *
 * A number a judge cannot reproduce on a machine with no key is not evidence, which is
 * why the free run is the one the reproduction guide quotes.
 *
 * `--replay` names what a bare `yarn sim overload` already did. It buys nothing at
 * runtime and one thing on the page: a command whose mode can be read off it — see the
 * rule in `src/cli/README.md`. Naming a scenario still skips every question.
 *
 * The API key is read here and nowhere deeper — see the note in `src/eval/index.ts`.
 *
 * This file is the only part of the player that touches a disk: it reads the scenario
 * and the case file, because `core/` reads nothing, and it writes the trajectory,
 * because `trajectory.ts` renders text and hands it back. Everything between the two is
 * pure, reads no clock, and is tested without either.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  askMode,
  askScenario,
  checkArguments,
  isCancelled,
  isInteractive,
  resolveMode,
  SIM_COMMAND,
  SIM_USAGE,
  wantsHelp,
} from '../cli/ask.ts';
import { loadEnvFile } from '../cli/env.ts';
import { caseLine, createProgress } from '../cli/progress.ts';
import { parseCaseFile, type CaseFile } from '../core/cases.ts';
import { PIPELINES } from '../core/pipeline.ts';
import { CRITICAL_COVERAGE_MINUTES } from '../core/policy.ts';
import { createRecordStore } from '../core/records.ts';
import { parseScenario, resolveArrivals, type Scenario } from '../core/scenario.ts';
import { isLiveCallFailed } from '../llm/anthropic.ts';
import { resolveParams } from '../llm/key.ts';
import { CACHE_FILE, isReplayMiss, readCacheIfPresent } from '../llm/replay.ts';
import { openLlmSession } from '../llm/session.ts';
import { playScenario } from './play.ts';
import { playedLine, reportLines } from './report.ts';
import { scoreTimeline } from './score.ts';
import { renderTrajectory, trajectoryFile } from './trajectory.ts';

/** Resolved from this file, so no command depends on the working directory. */
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CASES_FILE = `${REPO_ROOT}fixtures/cases.json`;
const SCENARIOS_DIR = `${REPO_ROOT}scenarios/`;
const TRAJECTORIES_DIR = `${REPO_ROOT}trajectories/`;

/** One line and an exit code. A judge should read what to do next, not our filenames. */
function stop(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);

// Answered before anything else happens: somebody asking what the command takes has
// not started a run, and should not be given one.
if (wantsHelp(args)) {
  console.log(SIM_USAGE);
  process.exit(0);
}

const env = loadEnvFile();
if (env.warning !== null) console.warn(env.warning);

// Spelling first. `yarn sim overlaod --replay` used to print `scenario: overlaod`,
// play nothing and exit 0, which reads as a run that worked.
const complaint = checkArguments({ args, command: SIM_COMMAND });
if (complaint !== null) stop(complaint);

// Found by shape rather than by position, so the flags may sit on either side of it.
const named = args.find((arg) => !arg.startsWith('-'));

// The mode question is asked only where the scenario question already is, so a named
// scenario runs on the flag it was given, or on replay when it was given none.
const mode = resolveMode({ args, canAsk: named === undefined && isInteractive() });

// Contradicting flags next: that is a mistake about this command whether or not the
// scenario is there, and it should be read before anything about a missing argument.
if (mode.mode === null) stop(`${mode.error}\n${SIM_USAGE}`);

// Nobody to ask, and nothing to run: the usage line, exactly as before the menu
// existed. An unattended run has to fail here rather than wait for an answer.
if (named === undefined && !isInteractive()) stop(SIM_USAGE);

const apiKey = process.env.ANTHROPIC_API_KEY;

const chosen = await (async (): Promise<{ scenario: string; live: boolean }> => {
  try {
    const scenario = named ?? (await askScenario());

    return {
      scenario,
      // A flag on the command line has already answered this one.
      live:
        mode.mode === 'ask'
          ? await askMode({
              apiKey,
              recorded: Object.keys(readCacheIfPresent(CACHE_FILE)).length,
            })
          : mode.mode === 'live',
    };
  } catch (error) {
    if (isCancelled(error)) {
      console.error('cancelled.');
      process.exit(130);
    }
    throw error;
  }
})();

// A usage mistake is reported as one line and an exit code, not as a stack trace. This
// command is quoted in the reproduction guide; a judge who runs it wrong should read
// what to do next, not read our filenames.
const params = resolveParams({ model: process.env.ANTHROPIC_MODEL });

const session = ((): ReturnType<typeof openLlmSession> => {
  try {
    return openLlmSession({ live: chosen.live, apiKey, params });
  } catch (error) {
    return stop(error instanceof Error ? error.message : String(error));
  }
})();

/** Either file failing to parse means the metric about to be printed is not the metric
 * anyone agreed to, so both stop here rather than playing a scenario nobody wrote. */
function load<T>(label: string, path: string, parse: (value: unknown) => T): T {
  try {
    return parse(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    return stop(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const scenario: Scenario = load(
  `scenarios/${chosen.scenario}.json`,
  `${SCENARIOS_DIR}${chosen.scenario}.json`,
  parseScenario,
);

const caseFile: CaseFile = load('fixtures/cases.json', CASES_FILE, parseCaseFile);

const arrivals = ((): ReturnType<typeof resolveArrivals> => {
  try {
    return resolveArrivals({ scenario, cases: caseFile.cases });
  } catch (error) {
    return stop(error instanceof Error ? error.message : String(error));
  }
})();

/**
 * Short, and never fatal. The commit names the code a trajectory came from; a clone
 * with no git history still produces the file, saying so.
 */
function headCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      // Asked of the repository rather than of wherever the command was typed.
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

console.log(`scenario: ${scenario.name}`);
console.log(`llm: ${session.label}`);
console.log(`arrivals: ${String(arrivals.length)}`);
console.log('');

/**
 * On stderr, so the metric on stdout stays a clean block, and only where a terminal can
 * take a rewritten line. The rule and the reason are in `src/cli/progress.ts`.
 */
const progress = createProgress({
  write: (chunk) => process.stderr.write(chunk),
  rewrites: process.stderr.isTTY === true,
});

const records = createRecordStore(caseFile);
const commit = headCommit();
mkdirSync(TRAJECTORIES_DIR, { recursive: true });

try {
  // Every line over the same scenario — dev/contracts/FEATURE-PARITY.md rule 4.
  for (const pipeline of PIPELINES) {
    let held = session.recorded();

    const timeline = await playScenario({
      pipeline,
      scenario: scenario.name,
      operator: scenario.operator,
      arrivals,
      records,
      llm: session.llm,
      windowMinutes: CRITICAL_COVERAGE_MINUTES,
      onArrival: (arrival) => {
        // What this arrival added to the cache. Zero on a live run means the answer was
        // already there — the same case arriving again costs nothing, which is exactly
        // why twenty-eight recordings cover a ninety-arrival run.
        const fresh = session.recorded() - held;
        held += fresh;

        progress.step(
          caseLine({
            pipeline: pipeline.name,
            done: arrival.done,
            total: arrival.total,
            caseId: `${arrival.messageId} ${arrival.caseId}`,
            llmCalls: arrival.llmCalls,
            recorded: chosen.live ? fresh : null,
          }),
        );

        // Saved as it goes rather than once at the end, so a live run that falls over
        // does not throw away answers somebody has already paid for.
        if (fresh > 0) session.save();
      },
    });

    progress.done(
      playedLine({
        pipeline: pipeline.name,
        scenario: scenario.name,
        arrivals: timeline.played.length,
      }),
    );

    const coverage = scoreTimeline(timeline);

    for (const line of reportLines(coverage)) console.log(line);
    console.log('');

    const name = trajectoryFile(pipeline.name, scenario.name);
    writeFileSync(
      `${TRAJECTORIES_DIR}${name}`,
      renderTrajectory({
        timeline,
        coverage,
        commit,
        llmLabel: session.label,
        params,
      }),
      'utf8',
    );
    console.log(`trajectory: trajectories/${name}`);
  }
} catch (error) {
  // Whatever a live run has already paid for is written down even if it fell over
  // halfway, so the next attempt does not buy the same answers twice.
  session.save();

  // A miss is not collected and counted the way `src/eval/` collects one. An empty
  // cache is a state a judge legitimately starts `yarn eval` from; by the time a
  // scenario plays, the cache is a committed deliverable covering every case, so a miss
  // means this run and the recorded one are not the same run. Nothing is printed and no
  // trajectory is kept in that state — a partial coverage number would be quoted as if
  // it covered the scenario.
  if (isReplayMiss(error)) {
    stop(
      `${error.message}\nsim: no coverage number was produced, so nothing was written.`,
    );
  }

  // A live call that never reached an answer — a rejected key, a rate limit, no network
  // — is a fact about the environment and gets one line. Anything else keeps its stack:
  // that one is a defect in a line, and the stack is the part somebody needs.
  if (isLiveCallFailed(error)) stop(error.message);
  throw error;
}

session.save();
