/**
 * The recorder.
 *
 * Two claims are checked: an answer it has already been given never reaches the model
 * again, and the file it writes is ordered rather than shuffled. The first is what
 * keeps a re-record from paying twice for the same case; the second is what keeps the
 * diff of a committed deliverable readable.
 */
import { describe, expect, it } from 'vitest';

import { cacheKey, PINNED_PARAMS } from '../../llm/key.ts';
import { recordingClient, serialiseCache, type MutableCache } from '../../llm/record.ts';
import { agreeingScript, refusingLlm, scriptedLlm } from '../fakes.ts';

const prompt = 'TASK: triage\nMESSAGE:\nWhere is ORD-2002?';

const script = agreeingScript({
  category: 'shipping',
  urgency: 20,
  confidence: 0.95,
  draft: 'ORD-2002 leaves the warehouse today.',
});

describe('recordingClient', () => {
  it('keeps what the wrapped client answered, under the request key', async () => {
    const cache: MutableCache = {};
    const inner = scriptedLlm(script);

    const response = await recordingClient({ inner, cache }).complete({ prompt });

    expect(response.text).toBe(script.triage);
    expect(cache[cacheKey({ prompt, params: PINNED_PARAMS })]).toEqual({
      effort: PINNED_PARAMS.effort,
      maxTokens: PINNED_PARAMS.maxTokens,
      model: PINNED_PARAMS.model,
      prompt,
      text: script.triage,
    });
  });

  it('does not call the wrapped client a second time for the same request', async () => {
    const cache: MutableCache = {};
    const inner = scriptedLlm(script);
    const llm = recordingClient({ inner, cache });

    await llm.complete({ prompt });
    const second = await llm.complete({ prompt });

    expect(second.text).toBe(script.triage);
    expect(inner.calls).toBe(1);
  });

  it('answers from a cache it was handed without reaching the model at all', async () => {
    const inner = refusingLlm();
    const cache: MutableCache = {
      [cacheKey({ prompt, params: PINNED_PARAMS })]: {
        effort: PINNED_PARAMS.effort,
        maxTokens: PINNED_PARAMS.maxTokens,
        model: PINNED_PARAMS.model,
        prompt,
        text: script.triage,
      },
    };

    const response = await recordingClient({ inner, cache }).complete({ prompt });

    expect(response.text).toBe(script.triage);
    expect(inner.calls).toBe(0);
  });
});

describe('serialiseCache', () => {
  it('writes keys in sorted order whatever order they were recorded in', () => {
    const entry = (prompt: string) => ({
      effort: PINNED_PARAMS.effort,
      maxTokens: PINNED_PARAMS.maxTokens,
      model: PINNED_PARAMS.model,
      prompt,
      text: 'x',
    });

    const written = serialiseCache({ bbb: entry('second'), aaa: entry('first') });

    expect(Object.keys(JSON.parse(written) as object)).toEqual(['aaa', 'bbb']);
    expect(written.indexOf('"aaa"')).toBeLessThan(written.indexOf('"bbb"'));
  });

  it('indents, and ends with exactly one newline', () => {
    const written = serialiseCache({});

    expect(written).toBe('{}\n');
    expect(
      serialiseCache({
        a: { effort: 'low', maxTokens: 1, model: 'm', prompt: 'p', text: 't' },
      }),
    ).toContain('\n  "a": {');
  });
});
