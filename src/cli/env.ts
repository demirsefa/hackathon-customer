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
 * run a person meant to start may be the one that needs a key. So the warning goes to
 * stderr, out of the way of the results, and it says what the absence actually costs
 * rather than reporting a missing file as news.
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
          `warn: ${path} not found. Replay runs need no credentials, so this only ` +
          'affects --live, which reads ANTHROPIC_API_KEY from the environment. ' +
          `Copy ${path}.example to ${path} if you meant to run live.`,
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
