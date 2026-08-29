/**
 * Entry point for the scenario player.
 *
 * Feeds a scenario's messages through `core/` in arrival order against a
 * simulated clock, and models the operator working the queue top-down.
 *
 *   yarn sim overload         replay recorded model responses, no API key needed
 *   yarn sim overload --live  real API calls, and records what they answered
 *   yarn sim                  at a terminal: pick the scenario and the mode
 *
 * The primary metric comes out of this program, so it carries the same two modes
 * `yarn eval` does. A number a judge cannot reproduce on a machine with no key is
 * not evidence, and this is the number the whole submission rests on.
 *
 * The menu is only ever a stand-in for the argument that is missing — see the rule
 * in `src/cli/README.md`. Naming a scenario skips it entirely, which is why the two
 * commands above still behave exactly as the reproduction guide says they do.
 *
 * The API key is read here and nowhere deeper — see the note in `src/eval/index.ts`.
 */
import { askMode, askScenario, isCancelled, isInteractive, USAGE } from '../cli/ask.ts';
import { loadEnvFile } from '../cli/env.ts';
import { openLlmSession } from '../llm/session.ts';

const env = loadEnvFile();
if (env.warning !== null) console.warn(env.warning);

const args = process.argv.slice(2);
const flagged = args.includes('--live');
// Found by shape rather than by position, so the flag may sit on either side of it.
const named = args.find((arg) => !arg.startsWith('--'));

// Nobody to ask, and nothing to run: the usage line, exactly as before the menu
// existed. An unattended run has to fail here rather than wait for an answer.
if (named === undefined && !isInteractive()) {
  console.error(USAGE);
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY;

const chosen = await (async (): Promise<{ scenario: string; live: boolean }> => {
  if (named !== undefined) return { scenario: named, live: flagged };

  try {
    const scenario = await askScenario();
    // `--live` on the command line has already answered this one.
    return {
      scenario,
      live: flagged || (await askMode(apiKey !== undefined && apiKey.length > 0)),
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
    return openLlmSession({ live: chosen.live, apiKey });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();

console.log(`scenario: ${chosen.scenario}`);
console.log(`llm: ${session.label}`);
console.log('steps: 0 (scenario player not implemented yet)');

session.save();
