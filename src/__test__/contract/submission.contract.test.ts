/**
 * Enforcement for dev/contracts/SUBMISSION.md.
 *
 * What a judge receives, checked the way a judge would meet it: the sections of the
 * README, the commands it hands out, the cells of its comparison tables, the
 * trajectories beside it. Nothing here reads the pipelines — that is
 * dev/contracts/FEATURE-PARITY.md, and a rule it owns is referenced, never copied.
 *
 * THIS FILE READS A CLOCK. No other test in the project does, and the cost is real:
 * green today, red tomorrow, with no commit in between. It is accepted deliberately.
 * Rules 1, 3, 4 and 5 describe deliverables that do not exist yet; asserting them now
 * means a suite that is red for two days, which teaches the habit of ignoring red —
 * the one disease a contract does not survive. So until the freeze instant those
 * rules REPORT, and from the freeze instant they ASSERT. The ledger of what is still
 * missing prints on every run.
 *
 * The freeze is Sunday 30 August 2026, 20:00 Europe/Istanbul (dev/CHALLENGE.md §2).
 * `SUBMISSION_NOW` overrides the clock so the post-freeze behaviour can be exercised
 * without waiting for it:
 *
 *   SUBMISSION_NOW=2026-08-31T00:00:00Z yarn test
 */
import { execFile } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterAll, describe, expect, it } from 'vitest';

import { PIPELINES } from '../../core/pipeline.ts';

const repoRoot = new URL('../../../', import.meta.url);

const read = (path: string): string => readFileSync(new URL(path, repoRoot), 'utf8');
const list = (path: string): readonly string[] => readdirSync(new URL(path, repoRoot));

const README = read('README.md');
const CHALLENGE = read('dev/CHALLENGE.md');
const PACKAGE_JSON = JSON.parse(read('package.json')) as {
  readonly scripts: Readonly<Record<string, string>>;
};

/** Sunday 30 August 2026, 20:00 Europe/Istanbul. dev/CHALLENGE.md §2. */
const FREEZE = Date.parse('2026-08-30T17:00:00Z');

const now = Date.parse(process.env.SUBMISSION_NOW ?? new Date().toISOString());
const frozen = Number.isNaN(now) ? true : now >= FREEZE;

/**
 * Rules 1, 3, 4 and 5 before the freeze: record the gap, fail nothing. The ledger is
 * printed once at the end of the file so a run always says what is still outstanding.
 */
const pending: string[] = [];

const required = (rule: number, what: string, ok: boolean): void => {
  if (ok) return;
  if (frozen) expect.soft(`${what} (rule ${String(rule)})`).toBe('present');
  else pending.push(`rule ${String(rule)}: ${what}`);
};

afterAll(() => {
  if (pending.length === 0) return;
  const freezeAt = new Date(FREEZE).toISOString();
  // Written straight to stderr rather than through `console`: vitest hides console
  // output from a passing file by default, and a ledger nobody sees is not a ledger.
  process.stderr.write(
    [
      '',
      `SUBMISSION contract — ${String(pending.length)} item(s) still open.`,
      `These become assertions at ${freezeAt} (dev/contracts/SUBMISSION.md).`,
      ...pending.map((entry) => `  · ${entry}`),
      '',
    ].join('\n'),
  );
});

// ---------------------------------------------------------------- markdown helpers

interface Table {
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

const cells = (line: string): readonly string[] =>
  line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());

const isDivider = (line: string): boolean => /^\s*\|[\s:|-]+\|\s*$/.test(line);

/** Every markdown table in a document, header row and body rows separated. */
const tablesIn = (markdown: string): readonly Table[] => {
  const lines = markdown.split('\n');
  const tables: Table[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index];
    const divider = lines[index + 1];
    if (header === undefined || divider === undefined) break;
    if (!header.trimStart().startsWith('|') || !isDivider(divider)) continue;

    const rows: (readonly string[])[] = [];
    let cursor = index + 2;
    for (; cursor < lines.length; cursor += 1) {
      const row = lines[cursor];
      if (row === undefined || !row.trimStart().startsWith('|')) break;
      rows.push(cells(row));
    }

    tables.push({ header: cells(header), rows });
    index = cursor - 1;
  }

  return tables;
};

/** A results table is one whose first header cell is `Metric` (rule 3). */
const isResultsTable = (table: Table): boolean =>
  table.header[0]?.replace(/\*/g, '') === 'Metric';

const headings = (markdown: string): readonly string[] =>
  markdown
    .split('\n')
    .filter((line) => line.startsWith('#'))
    .map((line) => line.trim());

/** Lines inside fenced ```bash blocks, comments and prompts stripped. */
const bashLines = (markdown: string): readonly string[] => {
  const out: string[] = [];
  let inside = false;

  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) {
      inside = /^```(bash|sh|shell|console)\s*$/.test(line);
      continue;
    }
    if (!inside) continue;
    const command = line
      .replace(/#.*$/, '')
      .replace(/^\s*\$\s*/, '')
      .trim();
    if (command !== '') out.push(command);
  }

  return out;
};

// -------------------------------------------------------- rule 1 · the deliverables

/** Spelled exactly as the contract's table spells them. */
const REQUIRED_SECTIONS = [
  '## The user and the bottleneck',
  '## Improvement Changelog',
  '## Results',
  '## Main failure mode',
  '## Hot take',
  '## Reproduction guide',
  '## Video',
  '## Sources',
] as const;

describe('rule 1 · the four deliverables have a named place', () => {
  const present = new Set(headings(README));

  it.each(REQUIRED_SECTIONS)('README carries `%s`', (section) => {
    required(1, `README is missing the section \`${section}\``, present.has(section));
  });

  it('the Video section carries a link', () => {
    const body = README.split('## Video')[1] ?? '';
    const section = body.split('\n## ')[0] ?? '';
    required(1, 'the Video section has no URL in it', /https?:\/\/\S+/.test(section));
  });
});

// ------------------------------------------------- rule 2 · every command resolves

describe('rule 2 · every command handed to a judge resolves', () => {
  /** Yarn's own verbs, which are not scripts in package.json. */
  const BUILTIN = new Set(['install', 'add', 'remove', 'dlx', 'why', 'run', 'set']);

  const documents = [
    ['README.md', README],
    ['CLAUDE.md', read('CLAUDE.md')],
    ['dev/CHALLENGE.md', CHALLENGE],
    ['dev/contracts/README.md', read('dev/contracts/README.md')],
    ['dev/contracts/SUBMISSION.md', read('dev/contracts/SUBMISSION.md')],
    ['dev/contracts/FEATURE-PARITY.md', read('dev/contracts/FEATURE-PARITY.md')],
  ] as const;

  const invocations = documents.flatMap(([file, markdown]) =>
    bashLines(markdown)
      .map((line) => /(?:^|\s)yarn\s+([\w:-]+)/.exec(line)?.[1])
      .filter((script): script is string => script !== undefined && !BUILTIN.has(script))
      .map((script) => ({ file, script })),
  );

  it('the documents actually hand out commands', () => {
    expect(invocations.length).toBeGreaterThan(0);
  });

  it.each(invocations)('$file promises `yarn $script`', ({ script }) => {
    expect(Object.keys(PACKAGE_JSON.scripts)).toContain(script);
  });
});

// ------------------------------------- rule 2 · and running one unattended ends

/**
 * The only check in this project that starts the programs.
 *
 * Everything else here reads files, and reading a file cannot tell whether `yarn sim`
 * hangs on a menu when nobody is at the keyboard, or whether a command that produced
 * no number exited 0 anyway. Both are invisible on the page and both are what a judge
 * meets first, so this one spawns them.
 *
 * Two things keep it safe to have in the suite: stdio is piped, so `isInteractive()`
 * is false at both ends and no prompt can open; and every run names `--replay`, so
 * nothing here can reach the network or spend a key whatever the environment holds.
 * The working directory is the system temp directory rather than the repository, so a
 * developer's local environment file cannot make the run behave differently on their
 * machine than on a clean clone.
 */
const run = promisify(execFile);

const entry = (path: string): string => fileURLToPath(new URL(path, repoRoot));

interface Attempt {
  readonly command: string;
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

const attempt = async (
  command: string,
  file: string,
  args: readonly string[],
): Promise<Attempt> => {
  // A non-zero exit rejects; the rejection carries the same three fields plus the
  // code, so both outcomes are read through one shape rather than two branches.
  const settled = (await run(process.execPath, [entry(file), ...args], {
    cwd: tmpdir(),
    timeout: 60_000,
    // Never inherited: a key in the environment must not be able to change what this
    // check does, and `--replay` must be the only path any of these runs can take.
    env: { ...process.env, ANTHROPIC_API_KEY: '' },
  }).catch((error: unknown) => error)) as {
    readonly code?: unknown;
    readonly stdout?: unknown;
    readonly stderr?: unknown;
  };

  const text = (value: unknown): string => (typeof value === 'string' ? value : '');

  return {
    command,
    code: typeof settled.code === 'number' ? settled.code : 0,
    stdout: text(settled.stdout),
    stderr: text(settled.stderr),
  };
};

/**
 * `yarn eval` writes `trajectories/<line>.md`, and the file names the commit it was
 * produced at, so running it here would leave a deliverable rewritten against whatever
 * HEAD happens to be — a check that dirties the working tree every time it passes.
 * The directory is put back exactly as it was found.
 */
const trajectories = new URL('trajectories/', repoRoot);

const before = new Map(
  readdirSync(trajectories).map((name) => [
    name,
    readFileSync(new URL(name, trajectories)),
  ]),
);

afterAll(() => {
  for (const [name, content] of before) {
    writeFileSync(new URL(name, trajectories), content);
  }
});

/** Every form the README hands out, plus the one a judge reaches by typing badly. */
const ATTEMPTS: readonly Attempt[] = await Promise.all([
  attempt('yarn eval --replay', 'src/eval/index.ts', ['--replay']),
  attempt('yarn eval --help', 'src/eval/index.ts', ['--help']),
  attempt('yarn sim overload --replay', 'src/sim/index.ts', ['overload', '--replay']),
  attempt('yarn sim --help', 'src/sim/index.ts', ['--help']),
  attempt('yarn sim nosuch --replay', 'src/sim/index.ts', ['nosuch', '--replay']),
  attempt('yarn serve', 'src/service/index.ts', []),
]);

describe('rule 2 · a documented command finishes with nobody at the keyboard', () => {
  // Reaching these at all is half the assertion: a prompt with piped stdio would have
  // held every one of them until the timeout killed it.
  it.each(ATTEMPTS)('$command answers instead of waiting', ({ stdout, stderr }) => {
    expect(`${stdout}${stderr}`.trim()).not.toBe('');
  });

  it.each(ATTEMPTS)('$command exits saying what it did', (result) => {
    if (result.code === 0) {
      // Exit 0 is read before anything else on the screen, so it may not stand over an
      // empty one: a run that produced nothing has to say so with a code.
      expect(result.stdout.trim(), `${result.command} exited 0 with no result`).not.toBe(
        '',
      );
      return;
    }

    expect(
      result.stderr.trim(),
      `${result.command} exited ${String(result.code)} with nothing on stderr`,
    ).not.toBe('');
  });

  it('a scenario that does not exist is refused rather than played', () => {
    const refused = ATTEMPTS.find((one) => one.command.includes('nosuch'));

    expect(refused?.code).not.toBe(0);
    expect(refused?.stderr).toContain('is not a scenario');
  });

  it.each(ATTEMPTS.filter((one) => one.command.endsWith('--help')))(
    '$command prints its usage line and stops',
    ({ code, stdout }) => {
      expect(code).toBe(0);
      expect(stdout).toContain('usage:');
    },
  );
});

// ------------------------------------------------------- rule 3 · no blank evidence

describe('rule 3 · a results table never has a blank cell', () => {
  const documents = [
    ['README.md', README],
    ['dev/CHALLENGE.md', CHALLENGE],
  ] as const;

  const results = documents.flatMap(([file, markdown]) =>
    tablesIn(markdown)
      .filter(isResultsTable)
      .map((table) => ({ file, table })),
  );

  it('there is a results table to check', () => {
    required(
      3,
      'no results table exists yet (header first cell `Metric`)',
      results.length > 0,
    );
  });

  /**
   * `pending` counts as unfilled, not as filled. It is the honest placeholder while the
   * numbers are being produced — it can never be mistaken for a measurement — but a
   * table still carrying one at the freeze is a comparison that was never run.
   */
  const unfilled = (cell: string): boolean => {
    const value = cell.replace(/[*`_]/g, '').trim().toLowerCase();
    return value === '' || value === 'pending';
  };

  it.each(results)('$file reports every cell', ({ table }) => {
    const missing = table.rows.flatMap((row) =>
      row
        .map((cell, column) => ({ cell, column }))
        .filter(({ cell, column }) => column > 0 && unfilled(cell))
        .map(({ column }) => `${row[0] ?? '?'} · column ${String(column + 1)}`),
    );

    required(3, `unfilled results cells: ${missing.join(', ')}`, missing.length === 0);
  });
});

// ------------------------------------------------ rule 4 · one trajectory per agent

describe('rule 4 · every agent has a trajectory a judge can follow', () => {
  const files = list('trajectories').filter((name) => name !== 'README.md');

  it.each(PIPELINES.map((pipeline) => pipeline.name))('`%s` has a trajectory', (name) => {
    required(
      4,
      `trajectories/ has no file for the \`${name}\` line`,
      files.some((file) => file.toLowerCase().includes(name.toLowerCase())),
    );
  });
});

// -------------------------------------------- rule 5 · the changelog tells the story

describe('rule 5 · every meaningful iteration has a changelog entry', () => {
  const changelog = tablesIn(README).find(
    (table) => table.header[0]?.replace(/\*/g, '') === 'Stage',
  );

  it('the Improvement Changelog is a table with the four columns', () => {
    required(
      5,
      'the Improvement Changelog table is missing or is not `Stage | What was tried and why | Evidence | Decision / Learning`',
      changelog !== undefined && changelog.header.length === 4,
    );
  });

  it('it carries the baseline and at least one iteration', () => {
    required(
      5,
      'the changelog has fewer than two rows',
      (changelog?.rows.length ?? 0) >= 2,
    );
  });

  it('every entry states its evidence and its decision', () => {
    const thin = (changelog?.rows ?? [])
      .filter((row) => row.slice(1).some((cell) => cell.trim() === ''))
      .map((row) => row[0] ?? '?');

    required(
      5,
      `changelog rows with an empty cell: ${thin.join(', ')}`,
      thin.length === 0,
    );
  });
});

// ---------------------------------------------------- rule 6 · prior work declared

describe('rule 6 · what existed before the competition is declared, file by file', () => {
  const sources = tablesIn(README).find((table) =>
    table.header.some((cell) => cell.replace(/\*/g, '').startsWith('Upstream')),
  );

  it('the Sources table exists and has rows', () => {
    expect(sources?.rows.length ?? 0).toBeGreaterThan(0);
  });

  it('every row carries an upstream URL and a pinned commit', () => {
    for (const row of sources?.rows ?? []) {
      const line = row.join(' | ');
      expect(line, `${row[0] ?? '?'} has no upstream URL`).toMatch(/https?:\/\/\S+/);
      expect(line, `${row[0] ?? '?'} is not pinned to a commit`).toMatch(
        /@[0-9a-f]{7,40}/,
      );
    }
  });

  it('the README states that everything else was written during the hackathon', () => {
    expect(README).toMatch(/written during the hackathon/i);
  });
});

// ----------------------------------------- rule 8 · referenced rules stay referenced

describe('rule 8 · a rule owned elsewhere is referenced, not copied', () => {
  it('credentials are kept out by `yarn security`, wired into every commit', () => {
    const lefthook = read('lefthook.yml');
    expect(PACKAGE_JSON.scripts).toHaveProperty('security');
    expect(lefthook).toMatch(/pre-commit/);
    expect(lefthook).toMatch(/yarn security/);
  });

  it('the approval gate is left to FEATURE-PARITY rather than restated here', () => {
    const contract = read('dev/contracts/SUBMISSION.md');
    expect(contract).toMatch(/FEATURE-PARITY/);
  });

  it('the contract is in the index', () => {
    expect(read('dev/contracts/README.md')).toMatch(/SUBMISSION\.md/);
  });
});
