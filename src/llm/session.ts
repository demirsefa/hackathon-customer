/**
 * Mode in, client out — the one place a harness decides how it will talk to a model.
 *
 * `src/eval/` and `src/sim/` both need this decision and it has to come out the same
 * way in both, so it is made once here rather than copied into two entry points that
 * then drift. What stays in the entry point is the single line that reads the API key
 * from the environment: this file takes it as an argument like everything else under
 * `src/llm/`, so there is exactly one place per program where a credential enters.
 *
 * Live implies recording. There is no separate `--record` flag, because the answer
 * has already been paid for by the time it arrives and writing it down is free — and
 * a recording step you have to remember is a recording step that gets forgotten, one
 * commit before the cache is needed on a machine with no key.
 */
import type { LlmClient } from '../core/llm.ts';
import { anthropicClient } from './anthropic.ts';
import { PINNED_PARAMS, type LlmParams } from './key.ts';
import { recordingClient, writeCache, type MutableCache } from './record.ts';
import { CACHE_FILE, CACHE_LABEL, readCache, readCacheIfPresent } from './replay.ts';
import { replayClient } from './replay.ts';

export interface LlmSession {
  readonly llm: LlmClient;
  /** One line for the run's header, so a report says which client produced it. */
  readonly label: string;
  /**
   * Exchanges held right now. Fixed in replay, and growing during a live run as
   * answers land, which is how a caller tells an answer it just paid for from one the
   * cache already had.
   */
  recorded(): number;
  /**
   * Writes anything newly recorded. A no-op in replay, which records nothing.
   *
   * Safe to call as often as a caller likes, and meant to be: a live run that saves
   * only at the end throws away every answer it bought if it falls over on the last
   * case.
   */
  save(): void;
}

export function openLlmSession(input: {
  readonly live: boolean;
  /** Read from the environment by the entry point, and nowhere else. */
  readonly apiKey: string | undefined;
  readonly params?: LlmParams;
  readonly path?: string;
}): LlmSession {
  const params = input.params ?? PINNED_PARAMS;
  const path = input.path ?? CACHE_FILE;

  if (!input.live) {
    const cache = readCache(path);
    const recorded = Object.keys(cache).length;

    return {
      llm: replayClient({ cache, params }),
      label: `replay (${params.model}) — ${recorded} recorded response(s) in ${CACHE_LABEL}`,
      recorded: () => recorded,
      save: () => {},
    };
  }

  if (input.apiKey === undefined || input.apiKey.length === 0) {
    // Refused here rather than at the first case, so a run that cannot possibly
    // finish says so before it starts spending anybody's evening.
    throw new Error(
      '--live needs ANTHROPIC_API_KEY in the environment. Without a key, drop the ' +
        `flag and the run replays ${CACHE_LABEL} instead.`,
    );
  }

  const cache: MutableCache = { ...readCacheIfPresent(path) };

  return {
    llm: recordingClient({
      inner: anthropicClient({ apiKey: input.apiKey, params }),
      cache,
      params,
    }),
    label: `live (${params.model}, effort ${params.effort}) — recording into ${CACHE_LABEL}`,
    recorded: () => Object.keys(cache).length,
    save: () => writeCache(cache, path),
  };
}
