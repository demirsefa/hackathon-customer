/**
 * Enforcement for dev/contracts/EXTERNAL-SOURCES-ARE-RECORDED.md.
 *
 * Two directions are checked. Forwards: every `## Sources` row is usable — it links
 * somewhere, it is pinned, and the path it names still exists. Backwards: every file
 * that announces it came from elsewhere is declared in one of those tables, so a copy
 * cannot sit in the tree with its origin known only to whoever pasted it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', '.yarn', '.idea', 'dist', 'coverage']);

/**
 * This folder is exempt from the backwards scan: the check has to spell out the words
 * it looks for, and it would otherwise report itself.
 */
const CHECKS_DIR = 'dev/contracts/checks';

function walk(directory: string): readonly string[] {
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIRS.has(entry.name) ? [] : walk(full);
    }
    return /\.(md|ts)$/.test(entry.name) ? [relative(ROOT, full)] : [];
  });
}

const FILES = walk(ROOT);

type SourceRow = {
  /** The markdown file the row was declared in. */
  readonly declaredIn: string;
  readonly cells: readonly string[];
};

function sourceRows(path: string): readonly SourceRow[] {
  const rows: string[][] = [];
  let inSection = false;

  for (const line of readFileSync(join(ROOT, path), 'utf8').split('\n')) {
    if (line.startsWith('#')) {
      inSection = line.trim().toLowerCase() === '## sources';
      continue;
    }
    if (!inSection || !line.trimStart().startsWith('|')) continue;

    const cells = line
      .trim()
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    rows.push(cells);
  }

  // The first row of the table is its header; everything after it is a claim.
  return rows.slice(1).map((cells) => ({ declaredIn: path, cells }));
}

const ROWS = FILES.filter((path) => path.endsWith('.md')).flatMap(sourceRows);

/** A pin is a commit, or a retrieval date when the source has no commits. */
const PIN = /@[0-9a-f]{7,40}\b|\d{4}-\d{2}-\d{2}/;

/** "Copied from …", but only when the line actually carries a link or a commit. */
const ANNOUNCED_COPY =
  /\b(?:copied|adapted|vendored|quoted) from\b[^\n]*(?:https?:\/\/|@[0-9a-f]{7,40})/i;

function declaredPaths(): ReadonlySet<string> {
  const paths = new Set<string>();

  for (const row of ROWS) {
    for (const backticked of row.cells[0]?.matchAll(/`([^`]+)`/g) ?? []) {
      const candidate = backticked[1];
      if (candidate === undefined) continue;

      const nearby = resolve(ROOT, dirname(row.declaredIn), candidate);
      const fromRoot = resolve(ROOT, candidate);
      for (const absolute of [nearby, fromRoot]) {
        paths.add(relative(ROOT, absolute));
      }
    }
  }

  return paths;
}

function exists(path: string): boolean {
  try {
    return statSync(join(ROOT, path)).isFile();
  } catch {
    // A missing path is the failure this check reports, not an error to rethrow.
    return false;
  }
}

/**
 * The root README is where an outsider — a judge, a reviewer, whoever clones this —
 * looks first, so every upstream declared anywhere in the tree has to be named there
 * too. The folder tables carry the detail; the README carries the fact.
 */
const README = 'README.md';
const ATTRIBUTION_HEADING = /^##+ .*(prior work|attribution|sources)/i;

function attributionSection(): string {
  const lines = readFileSync(join(ROOT, README), 'utf8').split('\n');
  const start = lines.findIndex((line) => ATTRIBUTION_HEADING.test(line));
  if (start === -1) return '';

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/** Upstreams are compared at repository level: host plus owner plus repo. */
function upstreamOrigins(): readonly string[] {
  const origins = new Set<string>();

  for (const row of ROWS) {
    for (const match of row.cells.join(' ').matchAll(/https?:\/\/[^\s<>)|]+/g)) {
      const url = new URL(match[0]);
      const [owner, repo] = url.pathname.split('/').filter(Boolean);
      if (owner === undefined || repo === undefined) continue;
      origins.add(`${url.host}/${owner}/${repo}`);
    }
  }

  return [...origins];
}

describe('external sources are recorded', () => {
  it('finds at least one declared source', () => {
    // A repository built partly from outside material with no table at all is the
    // failure this contract exists for, so an empty result is not a pass.
    expect(ROWS.length).toBeGreaterThan(0);
  });

  it('gives every source a link and a pin', () => {
    const broken = ROWS.filter((row) => {
      const line = row.cells.join(' | ');
      return !line.includes('https://') || !PIN.test(line);
    }).map((row) => `${row.declaredIn}: ${row.cells.join(' | ')}`);

    expect(broken).toEqual([]);
  });

  it('names paths that still exist', () => {
    const missing = ROWS.flatMap((row) =>
      [...(row.cells[0]?.matchAll(/`([^`]+)`/g) ?? [])]
        .map((match) => match[1])
        .filter((candidate): candidate is string => candidate !== undefined)
        .filter((candidate) => /\.[a-z]{2,4}$/.test(candidate))
        .filter(
          (candidate) =>
            !exists(join(dirname(row.declaredIn), candidate)) && !exists(candidate),
        )
        .map((candidate) => `${row.declaredIn} -> ${candidate}`),
    );

    expect(missing).toEqual([]);
  });

  it('declares every file that announces a copy', () => {
    const declared = declaredPaths();

    const undeclared = FILES.filter((path) => !path.startsWith(CHECKS_DIR)).filter(
      (path) => {
        const content = readFileSync(join(ROOT, path), 'utf8');
        if (!ANNOUNCED_COPY.test(content)) return false;

        // A file may carry its own table instead of being listed elsewhere.
        const selfDeclared = sourceRows(path).length > 0;
        return !selfDeclared && !declared.has(path);
      },
    );

    expect(undeclared).toEqual([]);
  });

  it('names every upstream in the root README', () => {
    const section = attributionSection();
    expect(section, `${README} has no prior-work or sources section`).not.toBe('');

    const missing = upstreamOrigins().filter((origin) => !section.includes(origin));

    expect(missing).toEqual([]);
  });
});
