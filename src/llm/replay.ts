/**
 * The replay client: the default way this project talks to a model.
 *
 * `fixtures/llm-cache.json` is a deliverable, not a build artefact. It is what lets
 * someone with no API key run `yarn eval` on a clean machine and get the published
 * number back, which is the Reproducibility criterion of dev/CHALLENGE.md §3.
 *
 * A miss throws. It does not fall through to a live call, and it does not return an
 * empty answer: either would let a run finish green while quietly producing a
 * different number, and nobody reading the output would see why.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { LlmClient, LlmRequest, LlmResponse } from '../core/llm.ts';
import { cacheKey, PINNED_PARAMS, type Effort, type LlmParams } from './key.ts';

/** Resolved from this file, so the path does not depend on the working directory. */
export const CACHE_FILE = fileURLToPath(
  new URL('../../fixtures/llm-cache.json', import.meta.url),
);

/** What messages say instead of an absolute path into somebody's home directory. */
export const CACHE_LABEL = 'fixtures/llm-cache.json';

/**
 * One recorded exchange. The four fields above `text` are exactly the object the key
 * was hashed over, so an entry states its own request and a reader can check it.
 */
export type CacheEntry = {
  readonly effort: Effort;
  readonly maxTokens: number;
  readonly model: string;
  readonly prompt: string;
  readonly text: string;
};

export type LlmCache = Readonly<Record<string, CacheEntry>>;

const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

function isEntry(value: unknown): value is CacheEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.prompt === 'string' &&
    typeof entry.text === 'string' &&
    typeof entry.model === 'string' &&
    typeof entry.maxTokens === 'number' &&
    EFFORTS.some((effort) => effort === entry.effort)
  );
}

/** Parsed strictly: a committed file that has been hand-edited into a wrong shape is
 * a reproducibility failure, so it is reported at load time rather than at the call
 * that happens to hit the damaged entry. */
export function parseCache(raw: string): LlmCache {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${CACHE_LABEL}: expected a JSON object of key -> entry.`);
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (!isEntry(value)) {
      throw new Error(`${CACHE_LABEL}: entry "${key}" is not a recorded exchange.`);
    }
  }

  return parsed as LlmCache;
}

/** The committed cache. A missing file is an error: replay has nothing to replay. */
export function readCache(path: string = CACHE_FILE): LlmCache {
  if (!existsSync(path)) {
    throw new Error(
      `${CACHE_LABEL} is missing. Replay needs it; record it with a key present ` +
        `(see src/llm/README.md) and commit the file.`,
    );
  }
  return parseCache(readFileSync(path, 'utf8'));
}

/** The same file, when an absent one means "nothing recorded yet" — recording only. */
export function readCacheIfPresent(path: string = CACHE_FILE): LlmCache {
  return existsSync(path) ? parseCache(readFileSync(path, 'utf8')) : {};
}

function missMessage(input: {
  readonly key: string;
  readonly params: LlmParams;
  readonly prompt: string;
}): string {
  const { key, params, prompt } = input;
  const opening = prompt.slice(0, 120).replace(/\n/g, '\\n');

  return [
    `${CACHE_LABEL}: no recorded response for key ${key}.`,
    `  model=${params.model} maxTokens=${params.maxTokens} effort=${params.effort}`,
    `  prompt starts: ${opening}`,
    'Replay never falls back to a live call — a silent one would change the published',
    'number without showing why. Re-record this request with ANTHROPIC_API_KEY set,',
    'wrapping the live client in src/llm/record.ts, then commit the updated file.',
  ].join('\n');
}

export function replayClient(input: {
  readonly cache: LlmCache;
  readonly params?: LlmParams;
}): LlmClient {
  const params = input.params ?? PINNED_PARAMS;

  return {
    // `async`, so a miss arrives as a rejected promise like any other client failure.
    // A synchronous throw from one implementation and a rejection from another is a
    // trap for every caller that has to handle both.
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const key = cacheKey({ prompt: request.prompt, params });
      const entry = input.cache[key];
      if (entry === undefined) {
        throw new Error(missMessage({ key, params, prompt: request.prompt }));
      }
      return { text: entry.text };
    },
  };
}
