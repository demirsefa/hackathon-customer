/**
 * The cache key. Everything reproducible about a replayed run rests on it being a
 * function of the request and nothing else, so both halves are pinned here: what must
 * move the key, and what must not.
 */
import { describe, expect, it } from 'vitest';

import { cacheKey, canonicalJson, PINNED_PARAMS, type LlmParams } from '../../llm/key.ts';

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
    ['the model', { ...PINNED_PARAMS, model: 'claude-sonnet-5' }],
    ['max tokens', { ...PINNED_PARAMS, maxTokens: 8000 }],
    ['the effort', { ...PINNED_PARAMS, effort: 'high' as const }],
  ])('moves when %s changes', (_name: string, params: LlmParams) => {
    expect(cacheKey({ prompt, params })).not.toBe(
      cacheKey({ prompt, params: PINNED_PARAMS }),
    );
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
