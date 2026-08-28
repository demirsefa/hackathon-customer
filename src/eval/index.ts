/**
 * Entry point for the evaluation run.
 *
 * Scores the evaluation cases against `core/` directly: one message in, one
 * decision out, compared to ground truth. No queue timing, no HTTP.
 *
 *   yarn eval            replay recorded model responses, no API key needed
 *   yarn eval -- --live  real API calls
 *
 * Note the `--` : without it the flag is consumed by the package manager
 * instead of being passed to this script.
 */

const live = process.argv.slice(2).includes('--live');
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

console.log(`mode: ${live ? 'live' : 'replay'}`);
console.log(`api key present: ${hasKey ? 'yes' : 'no'}`);
console.log('cases: 0 (evaluation set not implemented yet)');
