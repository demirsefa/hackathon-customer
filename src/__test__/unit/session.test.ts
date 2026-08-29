/**
 * Mode selection, shared by `src/eval/` and `src/sim/`.
 *
 * The assertion that earns its place is the one about `--live` without a key: it
 * fails before the run starts rather than at the first case, so a run that cannot
 * finish says so while somebody is still watching.
 */
import { describe, expect, it } from 'vitest';

import { PINNED_PARAMS } from '../../llm/key.ts';
import { openLlmSession } from '../../llm/session.ts';

describe('openLlmSession', () => {
  it('opens the committed cache in replay, whether or not a key is present', () => {
    const session = openLlmSession({ live: false, apiKey: undefined });

    // The model is in the label on both paths, so a mismatched override is read
    // off the first line rather than out of the miss it will cause.
    expect(session.label).toMatch(
      new RegExp(`^replay \\(${PINNED_PARAMS.model}\\) — \\d+ recorded response\\(s\\)`),
    );
    expect(session.label).toContain('fixtures/llm-cache.json');
    expect(() => session.save()).not.toThrow();
  });

  it('refuses --live without a key, and says what to do instead', () => {
    expect(() => openLlmSession({ live: true, apiKey: undefined })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
    expect(() => openLlmSession({ live: true, apiKey: '' })).toThrow(/drop the flag/);
  });

  it('records as it goes in live mode, rather than behind a second flag', () => {
    const session = openLlmSession({ live: true, apiKey: 'test-key-not-a-credential' });

    expect(session.label).toContain(`live (${PINNED_PARAMS.model}`);
    expect(session.label).toContain('recording into');
  });
});
