/**
 * The menu's boundaries. The prompts themselves need a terminal and are exercised by
 * hand; what is asserted here is the part that decides whether a prompt happens at
 * all, because that is the part a reproduction depends on.
 */
import { describe, expect, it } from 'vitest';

import { SCENARIOS, USAGE, isCancelled, isInteractive } from '../../cli/ask.ts';

describe('isInteractive', () => {
  it('needs a terminal at both ends', () => {
    expect(isInteractive({ stdin: { isTTY: true }, stdout: { isTTY: true } })).toBe(true);
  });

  it('refuses a piped run, which would hang on a question nobody answers', () => {
    expect(isInteractive({ stdin: { isTTY: true }, stdout: { isTTY: undefined } })).toBe(
      false,
    );
    expect(isInteractive({ stdin: { isTTY: undefined }, stdout: { isTTY: true } })).toBe(
      false,
    );
    expect(
      isInteractive({ stdin: { isTTY: undefined }, stdout: { isTTY: undefined } }),
    ).toBe(false);
  });
});

describe('isCancelled', () => {
  it('recognises Ctrl-C out of a prompt, so it does not print like a crash', () => {
    const cancelled = new Error('User force closed the prompt');
    cancelled.name = 'ExitPromptError';

    expect(isCancelled(cancelled)).toBe(true);
  });

  it('leaves every other failure alone', () => {
    expect(isCancelled(new Error('boom'))).toBe(false);
    expect(isCancelled('boom')).toBe(false);
    expect(isCancelled(undefined)).toBe(false);
  });
});

describe('USAGE', () => {
  it('is built from the scenarios, so the two cannot drift apart', () => {
    for (const scenario of SCENARIOS) expect(USAGE).toContain(scenario);
  });

  it('still names the flag, because the menu never replaces the argument form', () => {
    expect(USAGE).toContain('yarn sim <scenario>');
    expect(USAGE).toContain('--live');
  });
});
