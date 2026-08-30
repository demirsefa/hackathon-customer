/**
 * The two escapes the narration is allowed to use, and the rule about when.
 *
 * `--log` prints forty rows, and the eye is looking for two things in them: the row
 * that says a case was reached too late, and the ones that are only scaffolding. So
 * there are exactly two effects — `alarm` for the expensive failure, `dim` for
 * everything that holds the shape — and no third one to argue about. Four colours read
 * as a legend the reader has to learn; two read as emphasis.
 *
 * They are named for what they mean rather than for what they look like, so a caller
 * never picks a colour and this file stays the only place a colour is decided.
 *
 * It lives beside `progress.ts` because it answers the question that one answers —
 * what may be written to *this* destination — and gives the same answer: a terminal
 * takes escapes, a log file somebody reads later does not. Piped, redirected or in CI
 * every function here is the identity function, and the output is the plain text the
 * checks assert on.
 *
 * No library. `progress.ts` already writes its rewind by hand for the same reason:
 * three escape sequences are not worth a dependency in a submission a judge installs.
 */

/** Faint. For the scaffolding: headings, column legends, the gaps between openings. */
const DIM = '\u001b[2m';

/** Bold red. For the one thing in the block that costs something. */
const ALARM = '\u001b[1;31m';

const RESET = '\u001b[0m';

export interface Paint {
  /** Present, and not what the reader is looking for. */
  readonly dim: (text: string) => string;
  /** A missed hold, or a case reached after its window had closed. */
  readonly alarm: (text: string) => string;
}

/**
 * The painter that paints nothing, and the default everywhere.
 *
 * A renderer handed nothing produces plain text, which is what keeps the log modules
 * pure and their checks readable — an assertion against a string with an escape
 * sequence in it is an assertion nobody can read.
 */
export const PLAIN: Paint = {
  dim: (text) => text,
  alarm: (text) => text,
};

export function createPaint(input: { readonly colours: boolean }): Paint {
  if (!input.colours) return PLAIN;

  return {
    dim: (text) => `${DIM}${text}${RESET}`,
    alarm: (text) => `${ALARM}${text}${RESET}`,
  };
}

/**
 * Whether this destination should be written to in colour. Pure, so what is checked is
 * the rule rather than the terminal it was read off.
 *
 * A terminal, and nobody having said otherwise. `NO_COLOR` is honoured because it is
 * the convention people already set once for every tool they run; `TERM=dumb` because
 * an editor's output pane says so about itself; and `FORCE_COLOR` overrides both ways,
 * which is what makes `yarn sim overload --replay --log 2>&1 | less -R` readable.
 */
export function wantsColour(input: {
  readonly isTTY: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
}): boolean {
  const { env } = input;

  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '') {
    return env.FORCE_COLOR !== '0';
  }
  // Any non-empty value disables it — https://no-color.org. The empty string is
  // excluded there deliberately: `NO_COLOR=` is how somebody unsets it.
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
  if (env.TERM === 'dumb') return false;

  return input.isTTY;
}
