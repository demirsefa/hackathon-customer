/**
 * The menu's boundaries. The prompts themselves need a terminal and are exercised by
 * hand; what is asserted here is the part that decides whether a prompt happens at
 * all, because that is the part a reproduction depends on.
 */
import { describe, expect, it } from 'vitest';

import {
  EVAL_COMMAND,
  EVAL_USAGE,
  MODE_CONFLICT,
  SCENARIOS,
  SIM_COMMAND,
  SIM_USAGE,
  checkArguments,
  isCancelled,
  isInteractive,
  resolveMode,
  wantsHelp,
  wantsLog,
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

describe('SIM_USAGE', () => {
  it('is built from the scenarios, so the two cannot drift apart', () => {
    for (const scenario of SCENARIOS) expect(SIM_USAGE).toContain(scenario);
  });

  it('still names the flags, because the menu never replaces the argument form', () => {
    expect(SIM_USAGE).toContain('yarn sim <scenario>');
    expect(SIM_USAGE).toContain('--live');
    expect(SIM_USAGE).toContain('--replay');
    expect(SIM_USAGE).toContain('--log');
  });
});

describe('wantsLog', () => {
  it('is off unless it was asked for, which is what keeps the default output the same', () => {
    expect(wantsLog([])).toBe(false);
    expect(wantsLog(['overload', '--replay'])).toBe(false);
  });

  it('is read wherever it sits on the line, and past the npm separator', () => {
    expect(wantsLog(['--log'])).toBe(true);
    expect(wantsLog(['--log', 'overload', '--replay'])).toBe(true);
    expect(wantsLog(['--', '--log'])).toBe(true);
  });

  it('answers nothing about the mode: the two questions are independent', () => {
    expect(resolveMode({ args: ['--log'], canAsk: false }).mode).toBe('replay');
    expect(resolveMode({ args: ['--log', '--live'], canAsk: false }).mode).toBe('live');
  });
});

describe('checkArguments', () => {
  const sim = (...args: string[]): string | null =>
    checkArguments({ args, command: SIM_COMMAND });
  const evaluate = (...args: string[]): string | null =>
    checkArguments({ args, command: EVAL_COMMAND });

  it('passes the documented forms through untouched', () => {
    expect(evaluate('--replay')).toBeNull();
    expect(evaluate('--live')).toBeNull();
    expect(evaluate()).toBeNull();
    expect(sim('overload', '--replay')).toBeNull();
    expect(sim('--live', 'normal-day')).toBeNull();
    expect(sim()).toBeNull();
    // `--log` is a word both commands take, so it is not a usage mistake in either.
    expect(evaluate('--replay', '--log')).toBeNull();
    expect(sim('overload', '--log')).toBeNull();
  });

  it('refuses a misspelt flag instead of falling through to the bare form', () => {
    // The trap this exists for: `--lve` is not `--live`, and the run that follows is
    // the one nobody asked for.
    expect(sim('overload', '--lve')).toContain('unknown option `--lve`');
    expect(evaluate('--relpay')).toContain('unknown option `--relpay`');
  });

  it('refuses a scenario that does not exist, which used to run and exit 0', () => {
    const complaint = sim('overlaod', '--replay');

    expect(complaint).toContain('`overlaod` is not a scenario');
    // The list of real ones travels with the complaint; a name is not enough to fix it.
    for (const scenario of SCENARIOS) expect(complaint).toContain(scenario);
  });

  it('refuses two scenarios rather than silently playing the first', () => {
    expect(sim('overload', 'normal-day')).toContain('one scenario at a time');
  });

  it('refuses a stray word on the command that takes none', () => {
    expect(evaluate('overload')).toContain('it takes no argument');
  });

  it('ends every complaint on the usage line for that command', () => {
    expect(sim('nope')).toContain(SIM_USAGE);
    expect(evaluate('nope')).toContain(EVAL_USAGE);
  });

  it('lets `--` through, because yarn passes the npm habit straight to us', () => {
    expect(evaluate('--', '--replay')).toBeNull();
    expect(sim('--', 'overload', '--replay')).toBeNull();
  });
});

describe('wantsHelp', () => {
  it('recognises the question, so it is answered rather than refused', () => {
    expect(wantsHelp(['--help'])).toBe(true);
    expect(wantsHelp(['-h'])).toBe(true);
    expect(wantsHelp(['overload', '--replay'])).toBe(false);
  });
});
