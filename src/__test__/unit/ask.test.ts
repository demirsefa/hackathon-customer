/**
 * The menu's boundaries. The prompts themselves need a terminal and are exercised by
 * hand; what is asserted here is the part that decides whether a prompt happens at
 * all, because that is the part a reproduction depends on.
 */
import { describe, expect, it } from 'vitest';

import {
  MODE_CONFLICT,
  SCENARIOS,
  USAGE,
  isCancelled,
  isInteractive,
  resolveMode,
} from '../../cli/ask.ts';

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

describe('resolveMode', () => {
  it('runs a flagged command without asking, whoever is at the terminal', () => {
    expect(resolveMode({ args: ['--live'], canAsk: true })).toEqual({
      mode: 'live',
      error: null,
    });
    expect(resolveMode({ args: ['--replay'], canAsk: true })).toEqual({
      mode: 'replay',
      error: null,
    });
  });

  it('refuses both flags at once rather than guessing which one was meant', () => {
    expect(resolveMode({ args: ['--live', '--replay'], canAsk: true })).toEqual({
      mode: null,
      error: MODE_CONFLICT,
    });
    // Order on the command line does not make one of them the winner.
    expect(resolveMode({ args: ['--replay', '--live'], canAsk: false }).mode).toBe(null);
  });

  it('replays a bare command with nobody to ask, so an unattended run never hangs', () => {
    expect(resolveMode({ args: [], canAsk: false })).toEqual({
      mode: 'replay',
      error: null,
    });
  });

  it('asks for a bare command at a terminal, where somebody can answer', () => {
    expect(resolveMode({ args: [], canAsk: true })).toEqual({
      mode: 'ask',
      error: null,
    });
  });

  it('reads a flag past the other arguments, so it may sit on either side', () => {
    expect(resolveMode({ args: ['overload', '--live'], canAsk: false }).mode).toBe(
      'live',
    );
    expect(resolveMode({ args: ['--replay', 'overload'], canAsk: false }).mode).toBe(
      'replay',
    );
  });
});

describe('USAGE', () => {
  it('is built from the scenarios, so the two cannot drift apart', () => {
    for (const scenario of SCENARIOS) expect(USAGE).toContain(scenario);
  });

  it('still names the flags, because the menu never replaces the argument form', () => {
    expect(USAGE).toContain('yarn sim <scenario>');
    expect(USAGE).toContain('--live');
    expect(USAGE).toContain('--replay');
  });
});
