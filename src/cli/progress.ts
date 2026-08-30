/**
 * The line that says a run is still moving.
 *
 * `yarn eval --live` printed `cases: 28` and then nothing at all for as long as
 * twenty-eight model calls take. Minutes of silence, and no way to tell a working run
 * from a hung one — which is the same question the exit code answers at the end, asked
 * while there is still nothing to read.
 *
 * Two rules shape it, and both are about staying out of the way.
 *
 * It writes to **stderr**. The scorecard is the result and it owns stdout, so
 * `yarn eval --replay > results.txt` keeps a clean table and a judge watching the
 * terminal still sees the run move.
 *
 * And it rewrites its own line only where there is a terminal to rewrite it on. Piped,
 * redirected or in CI, carriage returns are rubbish in a log file and a line per case
 * is noise nobody reads, so nothing is written while the run goes and one summary line
 * stands for it afterwards.
 */

/** Erase the line and return to its start. Only ever written to a terminal. */
const REWIND = '\r\u001b[2K';

export type Progress = {
  /** One case finished. Seen only where the line can be overwritten. */
  step(line: string): void;
  /** The run is over: leave the terminal on a clean line, and say what it did. */
  done(summary: string): void;
};

export function createProgress(input: {
  readonly write: (chunk: string) => void;
  /** Whether the destination is a terminal, which is the only place a rewrite helps. */
  readonly rewrites: boolean;
}): Progress {
  return {
    step(line) {
      if (!input.rewrites) return;
      input.write(`${REWIND}${line}`);
    },
    done(summary) {
      // The rewind clears whatever step left behind; without a terminal there is
      // nothing to clear and the summary is the only line the run ever writes.
      input.write(`${input.rewrites ? REWIND : ''}${summary}\n`);
    },
  };
}

const plural = (count: number, noun: string): string =>
  `${String(count)} ${noun}${count === 1 ? '' : 's'}`;

/**
 * One case, as `baseline  7/28  inj-02 · 1 call, 1 recorded`.
 *
 * `recorded` is what this case newly wrote to the cache, and it is the interesting
 * number on a live run that is picking up where an interrupted one stopped: a case
 * that cost a call but recorded nothing was answered out of the cache and paid for
 * already. `null` is a run that records nothing at all, where the distinction has no
 * meaning and the words would only be in the way.
 */
export function caseLine(input: {
  readonly pipeline: string;
  readonly done: number;
  readonly total: number;
  readonly caseId: string;
  /** What the case cost, or `null` when it produced no decision at all. */
  readonly llmCalls: number | null;
  readonly recorded: number | null;
}): string {
  const counted = `${String(input.done)}/${String(input.total)}`;
  const head = `${input.pipeline}  ${counted}  ${input.caseId}`;

  if (input.llmCalls === null) return `${head} · no recorded response`;

  const calls = plural(input.llmCalls, 'call');

  return input.recorded === null || input.recorded === 0
    ? `${head} · ${calls}`
    : `${head} · ${calls}, ${String(input.recorded)} recorded`;
}

/**
 * What stands for the whole run once it is over, and the only line a log file gets.
 *
 * It carries what the scorecard does not: how long the run took, and how much of it
 * was newly paid for. The model-call count is the scorecard's own row and is not
 * repeated here — two lines saying the same number is how a reader learns to skip one.
 */
export function summaryLine(input: {
  readonly pipeline: string;
  readonly cases: number;
  /** Newly written to the cache over the run, or `null` when nothing was recorded. */
  readonly recorded: number | null;
  readonly elapsedMs: number;
}): string {
  const seconds = (input.elapsedMs / 1000).toFixed(1);
  const recorded =
    input.recorded === null ? '' : `, ${String(input.recorded)} newly recorded`;

  return `${input.pipeline}: ${plural(input.cases, 'case')} in ${seconds}s${recorded}`;
}
