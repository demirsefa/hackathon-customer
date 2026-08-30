/**
 * The line that says a run is still moving.
 *
 * The assertion that earns its place is the one about a destination that is not a
 * terminal: nothing per case, one summary, and no escape sequence anywhere in it. A
 * progress line is a courtesy on a terminal and rubbish in a log file, and the whole
 * point of the module is knowing which one it is writing to.
 */
import { describe, expect, it } from 'vitest';

import { caseLine, createProgress, summaryLine } from '../../cli/progress.ts';

const collect = (rewrites: boolean) => {
  const written: string[] = [];
  const progress = createProgress({
    write: (chunk) => written.push(chunk),
    rewrites,
  });
  return { progress, written, all: (): string => written.join('') };
};

describe('createProgress', () => {
  it('rewrites one line on a terminal, and ends on a clean one', () => {
    const { progress, written, all } = collect(true);

    progress.step('one');
    progress.step('two');
    progress.done('finished');

    expect(written).toHaveLength(3);
    expect(all()).toContain('one');
    expect(all()).toContain('two');
    // Every write starts by erasing what the last one left behind, and only the
    // summary ends the line, so the terminal is never left mid-sentence.
    expect(written.every((chunk) => chunk.startsWith('\r'))).toBe(true);
    expect(all().endsWith('finished\n')).toBe(true);
  });

  it('writes nothing per case without a terminal, and no escape sequences at all', () => {
    const { progress, written, all } = collect(false);

    progress.step('one');
    progress.step('two');
    progress.done('finished');

    expect(written).toEqual(['finished\n']);
    expect(all()).not.toContain('\u001b');
    expect(all()).not.toContain('\r');
  });
});

describe('caseLine', () => {
  const line = (over: Partial<Parameters<typeof caseLine>[0]> = {}): string =>
    caseLine({
      pipeline: 'baseline',
      done: 7,
      total: 28,
      caseId: 'inj-02',
      llmCalls: 1,
      recorded: null,
      ...over,
    });

  it('says where the run is, and which case it is on', () => {
    expect(line()).toContain('baseline');
    expect(line()).toContain('7/28');
    expect(line()).toContain('inj-02');
    expect(line()).toContain('1 call');
  });

  /**
   * The number that matters on a live run picking up where an interrupted one
   * stopped: a case that cost a call and recorded nothing was answered out of the
   * cache, and was paid for the first time round.
   */
  it('tells an answer just paid for from one the cache already had', () => {
    expect(line({ recorded: 1 })).toContain('1 recorded');
    expect(line({ recorded: 0 })).not.toContain('recorded');
  });

  it('says so when the cache could not answer the case at all', () => {
    expect(line({ llmCalls: null })).toContain('no recorded response');
  });

  it('counts in words that match the number', () => {
    expect(line({ llmCalls: 2 })).toContain('2 calls');
    expect(line({ llmCalls: 1 })).toContain('1 call');
  });
});

describe('summaryLine', () => {
  it('stands for the whole run, which is all a log file gets', () => {
    const summary = summaryLine({
      pipeline: 'baseline',
      cases: 28,
      recorded: 12,
      elapsedMs: 94_300,
    });

    expect(summary).toContain('baseline');
    expect(summary).toContain('28 cases');
    expect(summary).toContain('94.3s');
    expect(summary).toContain('12 newly recorded');
    // The scorecard already prints the call count; two lines carrying the same number
    // is how a reader learns to skip one.
    expect(summary).not.toContain('model call');
  });

  it('leaves the recording out of a run that records nothing', () => {
    const summary = summaryLine({
      pipeline: 'baseline',
      cases: 28,
      recorded: null,
      elapsedMs: 3_100,
    });

    expect(summary).not.toContain('recorded');
    expect(summary).toContain('3.1s');
  });
});
