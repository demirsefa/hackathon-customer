/**
 * Entry point for the runtime path: an HTTP surface over `core/`, backed by an
 * in-memory queue. Nothing reaches a customer without either an automatic-send
 * decision from `core/` or an explicit approval call from the operator.
 *
 *   yarn serve
 */
import { loadEnvFile } from '../cli/env.ts';

const env = loadEnvFile();
if (env.warning !== null) console.warn(env.warning);

// Nothing is listening, so the exit code does not say otherwise. A placeholder that
// exits 0 is the one output a reader takes for a program that started.
console.error('serve: the HTTP surface is not implemented yet — nothing is listening.');
process.exit(1);
