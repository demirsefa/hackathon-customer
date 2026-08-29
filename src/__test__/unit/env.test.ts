/**
 * Loading `.env`, and what is said when there is none.
 *
 * The assertion that earns its place is that a missing file is a warning and never
 * an exception: the default run of every program here replays a committed cache and
 * wants no environment at all, so an absent file must not be able to stop it.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { ENV_FILE, loadEnvFile } from '../../cli/env.ts';

const dir = mkdtempSync(join(tmpdir(), 'env-load-'));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('loadEnvFile', () => {
  it('warns rather than throwing when the file is not there', () => {
    const result = loadEnvFile(join(dir, 'absent'));

    expect(result.loaded).toBe(false);
    expect(result.warning).toContain('not found');
  });

  it('says what the absence costs, and what to do about it', () => {
    const result = loadEnvFile(join(dir, 'absent'));

    // Naming the flag and the variable is the whole point of replacing Node's own
    // line, which reported the missing file and nothing else.
    expect(result.warning).toContain('--live');
    expect(result.warning).toContain('ANTHROPIC_API_KEY');
    expect(result.warning).toContain('.example');
  });

  it('reads a file that is there, and then has nothing to say', () => {
    const path = join(dir, 'present');
    writeFileSync(path, 'SUPPORT_TRIAGE_ENV_PROBE=loaded\n');

    const result = loadEnvFile(path);

    expect(result.loaded).toBe(true);
    expect(result.warning).toBeNull();
    expect(process.env.SUPPORT_TRIAGE_ENV_PROBE).toBe('loaded');
  });

  it('tells an unreadable file apart from an absent one', () => {
    // A directory in the file's place: it exists, and it cannot be read as one.
    const result = loadEnvFile(dir);

    expect(result.loaded).toBe(false);
    expect(result.warning).toContain('could not be read');
    expect(result.warning).not.toContain('not found');
  });

  it('defaults to the package root, which is where `yarn run` starts', () => {
    expect(ENV_FILE).toBe('.env');
  });
});
