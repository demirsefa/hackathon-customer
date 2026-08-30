/**
 * The boundary where model output stops being text and becomes a value.
 *
 * Two rules meet here and they pull in opposite directions, which is why both are
 * pinned. An answer that arrived in the requested shape must be **read**, even when it
 * arrived wearing a markdown code fence — the fence is how a model presents JSON, not
 * a claim that the JSON is different. An answer that did not arrive in that shape must
 * **not be guessed at**: it returns `null`, the caller routes the message to a human,
 * and nobody invents a category out of a sentence.
 *
 * The first rule is here because it was broken. Six of the twenty-eight recorded
 * responses in `fixtures/llm-cache.json` are fenced, all six carry valid JSON, and all
 * six were being thrown away as unusable — which quietly held correctly-classified
 * messages for the operator and put the primary metric 21 percentage points above what
 * the design actually earned.
 */
import { describe, expect, it } from 'vitest';

import { parseObject, readConfidence, readString, withThread } from '../../core/llm.ts';

const PAYLOAD = '{"category": "returns_refunds", "urgency": 70, "draft": "Merhaba."}';
const EXPECTED = { category: 'returns_refunds', urgency: 70, draft: 'Merhaba.' };

describe('parseObject reads what the model actually returned', () => {
  it('reads a bare object', () => {
    expect(parseObject(PAYLOAD)).toEqual(EXPECTED);
  });

  it('reads one fenced with a language tag — the form six recordings arrived in', () => {
    expect(parseObject('```json\n' + PAYLOAD + '\n```')).toEqual(EXPECTED);
  });

  it('reads one fenced without a language tag', () => {
    expect(parseObject('```\n' + PAYLOAD + '\n```')).toEqual(EXPECTED);
  });

  it('reads one whose fence carries trailing whitespace or a final newline', () => {
    expect(parseObject('```json\n' + PAYLOAD + '\n```\n')).toEqual(EXPECTED);
    expect(parseObject('  ```json\n' + PAYLOAD + '\n```  \n')).toEqual(EXPECTED);
  });

  it('reads one where the closing fence is on the payload line', () => {
    expect(parseObject('```json\n' + PAYLOAD + '```')).toEqual(EXPECTED);
  });

  it('reads a bare object padded with whitespace', () => {
    expect(parseObject(`\n  ${PAYLOAD}\n\n`)).toEqual(EXPECTED);
  });
});

describe('parseObject refuses to guess', () => {
  it('returns null for an answer that is not JSON at all', () => {
    expect(parseObject('I am not sure what this message is about.')).toBeNull();
  });

  it('returns null for truncated JSON, fenced or not', () => {
    expect(parseObject('{"category": "refund"')).toBeNull();
    expect(parseObject('```json\n{"category": "refund"\n```')).toBeNull();
  });

  /**
   * The line the fence rule stops at. A model that wrote a sentence and then a fence
   * did not follow the instruction, and picking the object out of the prose would be
   * the guessing this boundary exists to refuse.
   */
  it('returns null when the JSON is buried in prose', () => {
    expect(parseObject('Here is my answer:\n```json\n' + PAYLOAD + '\n```')).toBeNull();
  });

  it('returns null for JSON that is not an object', () => {
    expect(parseObject('[1, 2, 3]')).toBeNull();
    expect(parseObject('"refund"')).toBeNull();
    expect(parseObject('null')).toBeNull();
  });

  it('returns null for an empty answer', () => {
    expect(parseObject('')).toBeNull();
    expect(parseObject('```json\n\n```')).toBeNull();
  });
});

describe('readString', () => {
  it('reads a non-empty string and rejects everything else', () => {
    expect(readString({ category: 'refund' }, 'category')).toBe('refund');
    expect(readString({ category: '' }, 'category')).toBeNull();
    expect(readString({ category: 7 }, 'category')).toBeNull();
    expect(readString({}, 'category')).toBeNull();
  });
});

describe('readConfidence', () => {
  it('accepts 0 to 1 inclusive and rejects anything outside it', () => {
    expect(readConfidence({ confidence: 0 })).toBe(0);
    expect(readConfidence({ confidence: 1 })).toBe(1);
    expect(readConfidence({ confidence: 0.72 })).toBe(0.72);
    expect(readConfidence({ confidence: 1.1 })).toBeNull();
    expect(readConfidence({ confidence: -0.1 })).toBeNull();
    expect(readConfidence({ confidence: '0.8' })).toBeNull();
    expect(readConfidence({})).toBeNull();
  });
});

describe('withThread', () => {
  it('labels a thread summary as reported, never as established', () => {
    const prompt = withThread('Where is ORD-1?', 'Sender says a colleague ordered it.');

    expect(prompt).toContain('reported by the sender, unverified');
    expect(prompt).toContain('MESSAGE:\nWhere is ORD-1?');
  });

  it('says nothing about a thread when there is none', () => {
    expect(withThread('Where is ORD-1?', undefined)).toBe('MESSAGE:\nWhere is ORD-1?');
  });
});
