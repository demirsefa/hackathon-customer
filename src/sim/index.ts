/**
 * Entry point for the scenario player.
 *
 * Feeds a scenario's messages through `core/` in arrival order against a
 * simulated clock, and models the operator working the queue top-down.
 *
 *   yarn sim overload --replay  recorded model responses, no API key needed
 *   yarn sim overload --live    real API calls, and records what they answered
 *   yarn sim overload           replay, as it always has: a named scenario runs
 *   yarn sim                    at a terminal: pick the scenario and the mode
 *
 * The primary metric comes out of this program, so it carries the same two modes
 * `yarn eval` does. A number a judge cannot reproduce on a machine with no key is
 * not evidence, and this is the number the whole submission rests on.
 *
 * `--replay` names what a bare `yarn sim overload` already did. It buys nothing at
 * runtime and one thing on the page: a command whose mode can be read off it, which
 * is the form the reproduction guide now quotes — see the rule in `src/cli/README.md`.
 * Naming a scenario still skips every question.
 *
 * The API key is read here and nowhere deeper — see the note in `src/eval/index.ts`.
 */
import {
  askMode,
  askScenario,
  isCancelled,
  isInteractive,
  resolveMode,
  USAGE,
} from '../cli/ask.ts';
import { loadEnvFile } from '../cli/env.ts';
import { resolveParams } from '../llm/key.ts';
import { CACHE_FILE, readCacheIfPresent } from '../llm/replay.ts';
import { openLlmSession } from '../llm/session.ts';

const env = loadEnvFile();
if (env.warning !== null) console.warn(env.warning);

const args = process.argv.slice(2);
// Found by shape rather than by position, so the flags may sit on either side of it.
const named = args.find((arg) => !arg.startsWith('--'));

// The mode question is asked only where the scenario question already is, so a named
// scenario runs on the flag it was given, or on replay when it was given none.
const mode = resolveMode({ args, canAsk: named === undefined && isInteractive() });

// Contradicting flags first: that is a mistake about this command whether or not the
// scenario is there, and it should be read before anything about a missing argument.
if (mode.mode === null) {
  console.error(mode.error);
  process.exit(1);
}

// Nobody to ask, and nothing to run: the usage line, exactly as before the menu
// existed. An unattended run has to fail here rather than wait for an answer.
if (named === undefined && !isInteractive()) {
  console.error(USAGE);
  process.exit(1);
}

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

// A usage mistake is reported as one line and an exit code, not as a stack trace.
// This command is quoted in the reproduction guide; a judge who runs it wrong should
// read what to do next, not read our filenames.
const session = ((): ReturnType<typeof openLlmSession> => {
  try {
    return openLlmSession({
      live: chosen.live,
      apiKey,
      params: resolveParams({ model: process.env.ANTHROPIC_MODEL }),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();

console.log(`scenario: ${chosen.scenario}`);
console.log(`llm: ${session.label}`);
console.log('steps: 0 (scenario player not implemented yet)');

session.save();
