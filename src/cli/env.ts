/**
 * Loads `.env`, and says one useful thing when there is none.
 *
 * This replaces `node --env-file-if-exists=.env` in the scripts. The flag did the
 * right thing and said it the wrong way: when the file is absent Node prints
 * `.env not found. Continuing without it.` on **stdout**, so the first line a judge
 * saw after `yarn eval` read like a failure — on the one path that is supposed to
 * need no credentials at all.
 *
 * What replaces it is not silence. An absent file is still worth a word, because the
 * run a person meant to start may be the one that needs a key. So the line goes to
 * stderr, out of the way of the results, and it says what the absence actually costs
 * rather than reporting a missing file as news.
 *
 * It is one line, and it says `note:` rather than `warn:`. On a clean clone this fires
 * on every run of the documented credential-free path, where nothing is wrong at all:
 * three sentences of prose about a credential, above the results, is the same mistake
 * Node made in a politer voice. A file that exists and cannot be read still warns —
 * there something is genuinely wrong.
 *
 * `process.loadEnvFile` is built into Node, so this costs no dependency and no flag.
 */

/** Read from the working directory, which is the package root under `yarn run`. */
export const ENV_FILE = '.env';

export type EnvLoad = {
  readonly loaded: boolean;
  /** One line for stderr, or `null` when there is nothing worth saying. */
  readonly warning: string | null;
};

/**
 * Never throws. A missing or unreadable `.env` is not a reason to stop: the default
 * run of every program here replays a committed cache and wants no environment.
 */
export function loadEnvFile(path: string = ENV_FILE): EnvLoad {
  try {
    process.loadEnvFile(path);
    return { loaded: true, warning: null };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT') {
      return {
        loaded: false,
        warning:
          `note: ${path} not found — replay needs no key; --live reads ` +
          `ANTHROPIC_API_KEY (copy ${path}.example).`,
      };
    }

    // A file that exists and cannot be read is a different problem from one that is
    // not there, and hiding the difference is how an evening gets spent on it.
    const detail = error instanceof Error ? error.message : String(error);

    return {
      loaded: false,
      warning: `warn: ${path} could not be read (${detail}). Continuing with the environment as it stands.`,
    };
  }
}
