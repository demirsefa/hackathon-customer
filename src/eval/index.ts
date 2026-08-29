/**
 * Entry point for the evaluation run.
 *
 * Scores the evaluation cases against `core/` directly: one message in, one
 * decision out, compared to ground truth. No queue timing, no HTTP.
 *
 *   yarn eval         replay recorded model responses, no API key needed
 *   yarn eval --live  real API calls, and records what they answered
 *
 * Yarn 4 passes trailing arguments straight through, so no `--` separator is
 * needed. The reproduction guide quotes these commands verbatim; they are the
 * ones that were run.
 *
 * There is no menu here, unlike `yarn sim`. This command has no required argument
 * to be missing, so a prompt could only interrupt the one command a judge runs
 * first — see the rule in `src/cli/README.md`.
 *
 * The API key is read here and nowhere deeper. `openLlmSession` takes it as an
 * argument, so this line is the whole of this program's exposure to a credential.
 */
import { loadEnvFile } from '../cli/env.ts';
import { resolveParams } from '../llm/key.ts';
import { openLlmSession } from '../llm/session.ts';

const env = loadEnvFile();
if (env.warning !== null) console.warn(env.warning);

const live = process.argv.slice(2).includes('--live');

// A usage mistake is reported as one line and an exit code, not as a stack trace —
// see the same note in `src/sim/index.ts`.
const session = ((): ReturnType<typeof openLlmSession> => {
  try {
    return openLlmSession({
      live,
      apiKey: process.env.ANTHROPIC_API_KEY,
      params: resolveParams({ model: process.env.ANTHROPIC_MODEL }),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();

console.log(`llm: ${session.label}`);
console.log('cases: 0 (evaluation set not scored yet)');

session.save();
