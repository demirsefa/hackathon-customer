import { describe, expect, it } from 'vitest';

import { hello } from '../core/hello.ts';

describe('hello', () => {
  it('greets the given name', () => {
    expect(hello('world')).toBe('hello, world');
  });

  it('does not lose an empty name', () => {
    expect(hello('')).toBe('hello, ');
  });
});
