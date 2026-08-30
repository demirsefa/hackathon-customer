/**
 * The recorder: wraps a client, keeps what it answered, writes it back out.
 *
 * It appends to the cache it was handed rather than rebuilding one, and the file is
 * written with its keys sorted, so re-recording a single case changes a single block
 * in the diff. A run that reshuffles the whole file hides the one line that actually
 * moved, and reviewing "which answer changed" is the reason this file is committed.
 *
 * A request already in the cache is served from it and never reaches the wrapped
 * client. Recording is therefore additive by construction: it cannot spend money on
 * answers it already has, and it cannot overwrite a recorded answer by accident.
 */
import { renameSync, writeFileSync } from 'node:fs';

import type { LlmClient, LlmRequest, LlmResponse } from '../core/llm.ts';
import { cacheKey, requestShape, PINNED_PARAMS, type LlmParams } from './key.ts';
import { CACHE_FILE, type CacheEntry, type LlmCache } from './replay.ts';

/** The cache while it is being filled. `LlmCache` is the same thing, read-only. */
export type MutableCache = Record<string, CacheEntry>;

export function recordingClient(input: {
  /** The client that answers a miss — in practice `anthropicClient`. */
  readonly inner: LlmClient;
  readonly cache: MutableCache;
  readonly params?: LlmParams;
}): LlmClient {
  const params = input.params ?? PINNED_PARAMS;

  return {
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const key = cacheKey({ prompt: request.prompt, params });

      const known = input.cache[key];
      if (known !== undefined) return { text: known.text };

      const response = await input.inner.complete(request);
      input.cache[key] = {
        ...requestShape({ prompt: request.prompt, params }),
        text: response.text,
      };
      return response;
    },
  };
}

/**
 * Written for a human to read: sorted keys at both levels, two-space indent, one
 * trailing newline. `.prettierignore` leaves the file alone so this stays the shape
 * it is committed in.
 */
export function serialiseCache(cache: LlmCache): string {
  const ordered: MutableCache = {};

  for (const key of Object.keys(cache).sort()) {
    const entry = cache[key];
    if (entry === undefined) continue;

    // Rebuilt field by field, so insertion order during a run cannot reach the file.
    ordered[key] = {
      effort: entry.effort,
      maxTokens: entry.maxTokens,
      model: entry.model,
      prompt: entry.prompt,
      text: entry.text,
    };
  }

  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/**
 * Written whole, then moved into place.
 *
 * A live run saves after every case it pays for, so this happens twenty-eight times
 * rather than once, and the file it is overwriting is a committed deliverable. A
 * `writeFileSync` interrupted halfway leaves a truncated cache behind — the one file
 * a reproduction depends on, damaged by a Ctrl-C. The rename is atomic, so the file at
 * `path` is always either the previous save or the current one, never half of either.
 */
export function writeCache(cache: LlmCache, path: string = CACHE_FILE): void {
  // The pid keeps two runs on the same machine off each other's temporary file.
  const staging = `${path}.${String(process.pid)}.tmp`;

  writeFileSync(staging, serialiseCache(cache), 'utf8');
  renameSync(staging, path);
}
