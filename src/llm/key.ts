/**
 * The cache key, and the model configuration it is computed over.
 *
 * A recorded run is only reproducible if the same request always lands on the same
 * key. So the key is a hash of a *canonical* serialisation: object keys are sorted
 * before hashing, and nothing about the calling code — insertion order, whitespace,
 * which entry point built the params — can move it.
 *
 * The parameters are pinned rather than passed around loosely, because the number
 * this project reports is a difference between two designs. A model setting that
 * drifts between runs turns that difference into noise, and no amount of care in
 * `core/` recovers it.
 */
import { createHash } from 'node:crypto';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type LlmParams = {
  readonly model: string;
  readonly maxTokens: number;
  readonly effort: Effort;
};

/**
 * The exact configuration every recorded and every live call uses, written out in
 * full so it can be quoted verbatim in the README and dev/CHALLENGE.md.
 *
 * There is no `temperature`. Claude Opus 5 removed the sampling parameters — sending
 * `temperature: 0` returns a 400 — so the reproducibility this project needs comes
 * from the replay cache, which is stronger than a sampling setting ever was: even at
 * temperature zero the API never promised the same bytes twice.
 */
export const PINNED_PARAMS: LlmParams = {
  model: 'claude-opus-5',
  maxTokens: 16000,
  effort: 'medium',
};

type Json =
  string | number | boolean | null | readonly Json[] | { readonly [k: string]: Json };

/**
 * JSON with every object's keys in sorted order and no incidental whitespace. Two
 * structurally equal values serialise identically whatever order they were built in.
 */
export function canonicalJson(value: Json): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);

  if (Array.isArray(value)) {
    // Array order is part of the value, so it is preserved rather than sorted.
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  const entries = Object.entries(value as { readonly [k: string]: Json });
  entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(',')}}`;
}

/** Exactly what is hashed, and exactly what a cache entry records beside the answer. */
export function requestShape(input: {
  readonly prompt: string;
  readonly params: LlmParams;
}): {
  readonly effort: Effort;
  readonly maxTokens: number;
  readonly model: string;
  readonly prompt: string;
} {
  return {
    effort: input.params.effort,
    maxTokens: input.params.maxTokens,
    model: input.params.model,
    prompt: input.prompt,
  };
}

/** `sha256(canonicalJson({ effort, maxTokens, model, prompt }))`, hex. */
export function cacheKey(input: {
  readonly prompt: string;
  readonly params: LlmParams;
}): string {
  return createHash('sha256')
    .update(canonicalJson(requestShape(input)), 'utf8')
    .digest('hex');
}
