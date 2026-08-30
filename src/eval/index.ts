/**
 * Entry point for the evaluation run.
 *
 * Scores the evaluation cases against `core/` directly: one message in, one
 * decision out, compared to ground truth. No queue timing, no HTTP.
 *
 *   yarn eval --replay  recorded model responses, no API key needed
 *   yarn eval --live    real API calls, and records what they answered
 *   yarn eval           at a terminal: pick the mode. Piped or in CI: replay
 *
 * Yarn 4 passes trailing arguments straight through, so no `--` separator is
 * needed. The reproduction guide quotes the two flagged commands verbatim; they are
 * the ones that were run.
 *
 * The bare command asks, where there is somebody to ask — see the rule in
 * `src/cli/README.md`. This command has no required argument, so unlike `yarn sim`
 * it never has a reason to stop: with no terminal the question is not asked and the
 * answer is replay, which is what the bare command always did.
 *
 * The API key is read here and nowhere deeper. Everything that needs it — the menu,
 * which greys out live without one, and `openLlmSession` — takes it as an argument,
 * so the one line below that reads the environment is the whole of this program's
 * exposure to a credential.
 *
 * This file is the only part of the evaluation that touches a disk: it reads the case
 * file, because `core/` reads nothing, and it writes the trajectories, because
 * `trajectory.ts` renders text and hands it back. Everything between the two is pure
 * and tested without either.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  askMode,
  checkArguments,
  EVAL_COMMAND,
  EVAL_USAGE,
  isCancelled,
  isInteractive,
  resolveMode,
  wantsHelp,
} from '../cli/ask.ts';
import { loadEnvFile } from '../cli/env.ts';
import { parseCaseFile, type CaseFile } from '../core/cases.ts';
import { PIPELINES } from '../core/pipeline.ts';
import { isLiveCallFailed } from '../llm/anthropic.ts';
import { resolveParams } from '../llm/key.ts';
import { CACHE_FILE, readCacheIfPresent } from '../llm/replay.ts';
import { openLlmSession } from '../llm/session.ts';
import { reportLines } from './report.ts';
import { runPipeline, unrecordedNotice, type PipelineRun } from './run.ts';
import { scoreRun } from './score.ts';
import { renderTrajectory, trajectoryFile } from './trajectory.ts';

/** Resolved from this file, so no command depends on the working directory. */
const CASES_FILE = fileURLToPath(new URL('../../fixtures/cases.json', import.meta.url));
const TRAJECTORIES_DIR = fileURLToPath(new URL('../../trajectories/', import.meta.url));

/** One line and an exit code. A judge should read what to do next, not our filenames. */
function stop(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);

// Answered before anything else happens: somebody asking what the command takes has
// not started a run, and should not be given one.
if (wantsHelp(args)) {
  console.log(EVAL_USAGE);
  process.exit(0);
}

const env = loadEnvFile();
if (env.warning !== null) console.warn(env.warning);

// A word this command cannot act on stops it here. Falling through to the bare form
// would replay — the safe run, but not the one that was typed, and silently.
const complaint = checkArguments({ args, command: EVAL_COMMAND });
if (complaint !== null) stop(complaint);

const mode = resolveMode({ args, canAsk: isInteractive() });

if (mode.mode === null) stop(`${mode.error}\n${EVAL_USAGE}`);

const apiKey = process.env.ANTHROPIC_API_KEY;

/** Read only to answer the menu; the session opens its own copy a moment later. */
const recordedCount = (): number => Object.keys(readCacheIfPresent(CACHE_FILE)).length;

const live = await (async (): Promise<boolean> => {
  if (mode.mode !== 'ask') return mode.mode === 'live';

  try {
    return await askMode({ apiKey, recorded: recordedCount() });
  } catch (error) {
    if (isCancelled(error)) {
      console.error('cancelled.');
      process.exit(130);
    }
    throw error;
  }
})();

const params = resolveParams({ model: process.env.ANTHROPIC_MODEL });

const session = ((): ReturnType<typeof openLlmSession> => {
  try {
    return openLlmSession({ live, apiKey, params });
  } catch (error) {
    return stop(error instanceof Error ? error.message : String(error));
  }
})();

// A case file that will not parse means the numbers about to be printed are not the
// numbers anyone agreed to, so it stops here rather than scoring a subset of itself.
const caseFile = ((): CaseFile => {
  try {
    return parseCaseFile(JSON.parse(readFileSync(CASES_FILE, 'utf8')));
  } catch (error) {
    return stop(
      `fixtures/cases.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
})();

/**
 * Short, and never fatal. The commit names the code a trajectory came from; a clone
 * with no git history still produces the file, saying so.
 */
function headCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

console.log(`llm: ${session.label}`);
console.log(`cases: ${String(caseFile.cases.length)}`);
console.log('');

const runs: PipelineRun[] = [];

/** Set only by a live call that never reached an answer; see the catch below. */
let liveFailure: string | null = null;

try {
  // Every line over the same case list — dev/contracts/FEATURE-PARITY.md rule 4.
  for (const pipeline of PIPELINES) {
    runs.push(await runPipeline({ pipeline, caseFile, llm: session.llm }));
  }
} catch (error) {
  // A live call that never reached an answer — a rejected key, a rate limit, no
  // network — is a fact about the environment, exactly like a missing key, and it gets
  // one line for the same reason. Anything else keeps its stack: that one is a defect
  // in a line, and the stack is the part somebody needs.
  if (!isLiveCallFailed(error)) throw error;
  liveFailure = error.message;
} finally {
  // Whatever a live run has already paid for is written down even if it fell over
  // halfway, so the next attempt does not buy the same answers twice.
  session.save();
}

if (liveFailure !== null) stop(liveFailure);

const missing = runs.flatMap((run) => run.unrecorded);

// Nothing is printed and nothing is written in this state. A table covering part of
// the set is a number that will be quoted as if it covered all of it.
if (missing.length > 0) {
  stop(
    unrecordedNotice({ unrecorded: missing, total: caseFile.cases.length * runs.length }),
  );
}

const commit = headCommit();
mkdirSync(TRAJECTORIES_DIR, { recursive: true });

for (const run of runs) {
  const scorecard = scoreRun({ pipeline: run.pipeline, outcomes: run.runs });

  for (const line of reportLines(scorecard)) console.log(line);
  console.log('');

  const path = `${TRAJECTORIES_DIR}${trajectoryFile(run.pipeline)}`;
  writeFileSync(
    path,
    renderTrajectory({ run, scorecard, commit, llmLabel: session.label, params }),
    'utf8',
  );
  console.log(`trajectory: trajectories/${trajectoryFile(run.pipeline)}`);
}
