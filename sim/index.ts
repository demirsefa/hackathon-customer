/**
 * Entry point for the scenario player.
 *
 * Feeds a scenario's messages through `core/` in arrival order against a
 * simulated clock, and models the operator working the queue top-down.
 *
 *   yarn sim normal-day
 *   yarn sim overload
 */
import { hello } from '../core/hello.ts';

const scenario = process.argv[2];

if (scenario === undefined) {
  console.error('usage: yarn sim <scenario>   (normal-day | overload)');
  process.exit(1);
}

console.log(hello('sim'));
console.log(`scenario: ${scenario}`);
console.log('steps: 0 (scenario player not implemented yet)');
