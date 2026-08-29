/**
 * The replay client.
 *
 * The assertion that matters is the miss: it throws. A replay that quietly fell
 * through to a live call, or returned an empty answer, would let `yarn eval` finish
 * green while reporting a different number — and nothing in the output would say so.
 */
import { describe, expect, it } from 'vitest';

import { cacheKey, PINNED_PARAMS } from '../../llm/key.ts';
import { parseCache, replayClient, type LlmCache } from '../../llm/replay.ts';

const prompt = 'TASK: triage\nMESSAGE:\nWhere is ORD-2002?';
const answer = JSON.stringify({ category: 'shipping', urgency: 20, draft: 'Today.' });

const recorded: LlmCache = {
  [cacheKey({ prompt, params: PINNED_PARAMS })]: {
    effort: PINNED_PARAMS.effort,
    maxTokens: PINNED_PARAMS.maxTokens,
    model: PINNED_PARAMS.model,
    prompt,
    text: answer,
  },
};

describe('replayClient', () => {
  it('returns the recorded answer on a hit', async () => {
    const llm = replayClient({ cache: recorded });

    await expect(llm.complete({ prompt })).resolves.toEqual({ text: answer });
  });

  it('throws on a miss, naming the key and how to record it', async () => {
    const llm = replayClient({ cache: recorded });
    const missing = 'TASK: triage\nMESSAGE:\nWhere is ORD-9999?';

    await expect(llm.complete({ prompt: missing })).rejects.toThrow(
      cacheKey({ prompt: missing, params: PINNED_PARAMS }),
    );
    await expect(llm.complete({ prompt: missing })).rejects.toThrow(/Re-record/);
  });

  it('treats a request recorded under other parameters as a miss', async () => {
    const llm = replayClient({
      cache: recorded,
      params: { ...PINNED_PARAMS, effort: 'high' },
    });

    await expect(llm.complete({ prompt })).rejects.toThrow(/no recorded response/);
  });
});

describe('parseCache', () => {
  it('accepts the shape it writes', () => {
    expect(parseCache(JSON.stringify(recorded))).toEqual(recorded);
  });

  it.each([
    ['the file is not an object', '[]'],
    ['an entry is missing its answer', JSON.stringify({ abc: { prompt: 'x' } })],
    [
      'an entry claims an effort that does not exist',
      JSON.stringify({
        abc: { effort: 'ludicrous', maxTokens: 1, model: 'm', prompt: 'p', text: 't' },
      }),
    ],
  ])('rejects a cache where %s', (_name: string, raw: string) => {
    expect(() => parseCache(raw)).toThrow();
  });
});
