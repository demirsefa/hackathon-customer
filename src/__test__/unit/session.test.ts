/**
 * Mode selection, shared by `src/eval/` and `src/sim/`.
 *
 * The assertion that earns its place is the one about `--live` without a key: it
 * fails before the run starts rather than at the first case, so a run that cannot
 * finish says so while somebody is still watching.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { cacheKey, PINNED_PARAMS } from '../../llm/key.ts';
import { openLlmSession } from '../../llm/session.ts';

const dir = mkdtempSync(join(tmpdir(), 'llm-session-'));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

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

  /**
   * A live run reads this after every case to tell an answer it has just paid for
   * from one the cache already held, and to decide whether there is anything new
   * worth writing to disk yet.
   */
  it('says how many exchanges it is holding, on both paths', () => {
    const replay = openLlmSession({ live: false, apiKey: undefined });
    const live = openLlmSession({ live: true, apiKey: 'test-key-not-a-credential' });

    expect(replay.recorded()).toBeGreaterThanOrEqual(0);
    expect(replay.label).toContain(`${String(replay.recorded())} recorded response(s)`);
    expect(live.recorded()).toBe(replay.recorded());
  });

  /**
   * What a re-run of an interrupted live run does. The recorded answers are picked up
   * and never bought a second time — the reason a live run may now save after every
   * case rather than once at the end, and the reason saving often is worth anything.
   */
  it('picks a recorded answer back up instead of paying for it again', async () => {
    const prompt = 'TASK: triage\nMESSAGE:\nWhere is ORD-2002?';
    const path = join(dir, 'resumed.json');

    writeFileSync(
      path,
      JSON.stringify({
        [cacheKey({ prompt, params: PINNED_PARAMS })]: {
          effort: PINNED_PARAMS.effort,
          maxTokens: PINNED_PARAMS.maxTokens,
          model: PINNED_PARAMS.model,
          prompt,
          text: 'the answer somebody already paid for',
        },
      }),
    );

    const session = openLlmSession({
      live: true,
      // Never used: the request below is already in the cache, so nothing reaches the
      // live client and this test opens no connection.
      apiKey: 'test-key-not-a-credential',
      path,
    });

    expect(session.recorded()).toBe(1);
    await expect(session.llm.complete({ prompt })).resolves.toEqual({
      text: 'the answer somebody already paid for',
    });
    expect(session.recorded()).toBe(1);
  });

  /**
   * A live run now saves after every case it pays for, so this happens twenty-eight
   * times against a committed deliverable rather than once. Written whole and moved
   * into place, so an interrupted save cannot leave half a cache behind.
   */
  it('saves repeatedly, leaving one whole file and no debris', () => {
    const path = join(dir, 'saved.json');
    writeFileSync(path, '{}\n');

    const session = openLlmSession({
      live: true,
      apiKey: 'test-key-not-a-credential',
      path,
    });

    session.save();
    session.save();

    expect(readFileSync(path, 'utf8')).toBe('{}\n');
    expect(readdirSync(dir).filter((name) => name.includes('.tmp'))).toEqual([]);
  });
});
