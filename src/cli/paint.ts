/**
 * The two escapes the narration is allowed to use, and the rule about when.
 *
 * The narration is forty rows, and the eye is looking for two things in them: the row
 * that says a case was reached too late, and the ones that are only scaffolding. So
 * there are exactly two effects — `alarm` for the expensive failure, `dim` for
 * everything that holds the shape — and no third one to argue about. Four colours read
 * as a legend the reader has to learn; two read as emphasis.
 *
 * They are named for what they mean rather than for what they look like, so a caller
 * never picks a colour and this file stays the only place a colour is decided.
 *
 * It lives beside `progress.ts` because it answers the question that one answers: what
 * may be written to this destination. The answers differ, and deliberately. Rewriting a
 * line in place is rubbish anywhere but a terminal, so `progress.ts` asks about a TTY.
 * Colour does not ask: it is on unless the environment says otherwise, because the
 * console this run is actually watched in — an IDE's — is a pipe, and asking about a
 * TTY there printed grey on exactly the machine somebody was watching.
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
 * Whether to write in colour. Pure, so what is checked is the rule and not the terminal
 * it was read off.
 *
 * **On unless somebody said otherwise.** It used to want a TTY as well, and that was
 * wrong in the place the run is actually watched: an IDE's run console is a pipe, so
 * the narration came out grey there while a shell got the colour. One behaviour beats a
 * clever one, and what it costs — escape sequences inside `2> run.txt` — is worth less
 * than the run somebody reads every day.
 *
 * `NO_COLOR` still turns it off, because that is the switch people set once for every
 * tool they run, and `TERM=dumb` because a terminal saying so about itself is not a
 * guess.
 */
export function wantsColour(input: {
  readonly env: Readonly<Record<string, string | undefined>>;
}): boolean {
  const { env } = input;

  // Any non-empty value disables it — https://no-color.org. The empty string is
  // excluded there deliberately: `NO_COLOR=` is how somebody unsets it.
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;

  return env.TERM !== 'dumb';
}
