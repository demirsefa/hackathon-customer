/**
 * The cache key. Everything reproducible about a replayed run rests on it being a
 * function of the request and nothing else, so both halves are pinned here: what must
 * move the key, and what must not.
 */
import { describe, expect, it } from 'vitest';

import {
  cacheKey,
  canonicalJson,
  PINNED_PARAMS,
  resolveParams,
  type LlmParams,
} from '../../llm/key.ts';

const prompt = 'TASK: triage\nMESSAGE:\nWhere is ORD-2002?';

describe('cacheKey', () => {
  it('gives the same key to the same request', () => {
    const first = cacheKey({ prompt, params: PINNED_PARAMS });
    const second = cacheKey({ prompt, params: { ...PINNED_PARAMS } });

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not move when the parameters are written in a different order', () => {
    const declared: LlmParams = {
      model: 'claude-opus-5',
      maxTokens: 16000,
      effort: 'medium',
    };
    const reordered: LlmParams = {
      effort: 'medium',
      maxTokens: 16000,
      model: 'claude-opus-5',
    };

    expect(cacheKey({ prompt, params: reordered })).toBe(
      cacheKey({ prompt, params: declared }),
    );
  });

  it('moves when the prompt changes', () => {
    expect(cacheKey({ prompt: `${prompt} `, params: PINNED_PARAMS })).not.toBe(
      cacheKey({ prompt, params: PINNED_PARAMS }),
    );
  });

  it.each([
    ['the model', { ...PINNED_PARAMS, model: 'claude-opus-5' }],
    ['max tokens', { ...PINNED_PARAMS, maxTokens: 8000 }],
    ['the effort', { ...PINNED_PARAMS, effort: 'high' as const }],
  ])('moves when %s changes', (_name: string, params: LlmParams) => {
    expect(cacheKey({ prompt, params })).not.toBe(
      cacheKey({ prompt, params: PINNED_PARAMS }),
    );
  });
});

describe('resolveParams', () => {
  it('keeps the pinned configuration when nothing overrides it', () => {
    expect(resolveParams({ model: undefined })).toEqual(PINNED_PARAMS);
  });

  it('treats a blank value as no value, so an empty setting changes nothing', () => {
    expect(resolveParams({ model: '   ' })).toEqual(PINNED_PARAMS);
  });

  it('applies the override to the model and to nothing else', () => {
    const resolved = resolveParams({ model: ' claude-opus-5 ' });

    expect(resolved.model).toBe('claude-opus-5');
    expect(resolved.maxTokens).toBe(PINNED_PARAMS.maxTokens);
    expect(resolved.effort).toBe(PINNED_PARAMS.effort);
  });

  // The override is only safe because it cannot move a number quietly: a replay of
  // the committed cache misses on the new key and stops with the model printed.
  it('lands on a different cache key, which is what makes the override loud', () => {
    expect(
      cacheKey({ prompt, params: resolveParams({ model: 'claude-opus-5' }) }),
    ).not.toBe(cacheKey({ prompt, params: PINNED_PARAMS }));
  });
});

describe('canonicalJson', () => {
  it('sorts object keys at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('keeps array order, because order is part of the value', () => {
    expect(canonicalJson(['b', 'a'])).toBe('["b","a"]');
  });
});
