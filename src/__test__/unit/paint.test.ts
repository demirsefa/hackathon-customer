/**
 * The rule about when a destination may be written to in colour, and the two effects
 * that are allowed once it may.
 *
 * The rule is what is checked rather than the terminal it was read off: `wantsColour`
 * takes the flag and the environment as values, so "a log file gets no escapes" is a
 * check that runs in the suite instead of a thing somebody notices in a pipe.
 *
 * The escape sequences are written as `\u001b` here for the same reason they are in
 * `paint.ts`: a raw control byte in a source file is invisible in a diff.
 */
import { describe, expect, it } from 'vitest';

import { createPaint, PLAIN, wantsColour } from '../../cli/paint.ts';

const ESC = '\u001b';

describe('createPaint', () => {
  it('paints nothing at all when the destination cannot take it', () => {
    const paint = createPaint({ colours: false });

    expect(paint.dim('merve — baseline')).toBe('merve — baseline');
    expect(paint.alarm('LATE')).toBe('LATE');
    expect(paint).toBe(PLAIN);
  });

  it('wraps and closes, so nothing after it inherits the colour', () => {
    const paint = createPaint({ colours: true });

    expect(paint.alarm('LATE')).toBe(`${ESC}[1;31mLATE${ESC}[0m`);
    expect(paint.dim('interim sent')).toBe(`${ESC}[2minterim sent${ESC}[0m`);
  });
});

describe('wantsColour', () => {
  const env = (values: Readonly<Record<string, string>> = {}) => values;

  it('needs a terminal: a redirected run writes plain text', () => {
    expect(wantsColour({ isTTY: true, env: env() })).toBe(true);
    expect(wantsColour({ isTTY: false, env: env() })).toBe(false);
  });

  it('honours NO_COLOR, which somebody sets once for every tool they run', () => {
    expect(wantsColour({ isTTY: true, env: env({ NO_COLOR: '1' }) })).toBe(false);
    // The empty value is how it is unset again, and it means nothing was said.
    expect(wantsColour({ isTTY: true, env: env({ NO_COLOR: '' }) })).toBe(true);
  });

  it('believes a terminal that says it is dumb', () => {
    expect(wantsColour({ isTTY: true, env: env({ TERM: 'dumb' }) })).toBe(false);
  });

  it('lets FORCE_COLOR answer in both directions, which is what makes a pipe readable', () => {
    expect(wantsColour({ isTTY: false, env: env({ FORCE_COLOR: '1' }) })).toBe(true);
    expect(wantsColour({ isTTY: true, env: env({ FORCE_COLOR: '0' }) })).toBe(false);
    // It is read before NO_COLOR: the one typed on this command line wins over the
    // one exported in a shell profile months ago.
    expect(
      wantsColour({ isTTY: false, env: env({ FORCE_COLOR: '1', NO_COLOR: '1' }) }),
    ).toBe(true);
  });
});
