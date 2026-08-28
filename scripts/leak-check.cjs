#!/usr/bin/env node
'use strict';

/**
 * Submission gate.
 *
 * Nothing that describes the machine this was built on, and no credential, may
 * reach the repository. This is a hackathon submission: credentials and private
 * information stay out of it.
 *
 * Design rule — match shapes, never names.
 *
 * A deny list of private terms, committed to a public repository, hands a
 * reader the exact inventory it exists to hide. So every pattern below
 * describes the *form* of a disclosure, not any particular value. The single
 * name this looks for is the account name of whoever is running it, read from
 * the machine at runtime and never written into this file — and when it
 * matches, the matched text is never printed.
 *
 * The patterns are also written so this file does not trip itself: each one
 * ends up with a regex metacharacter where a real disclosure would have a
 * literal, so scanning this file finds nothing.
 *
 * Node built-ins only, no dependencies, so it runs before anything is
 * installed. CommonJS, hence the .cjs extension — package.json declares
 * "type": "module" for the rest of the project.
 */

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { homedir } = require('node:os');
const { basename } = require('node:path');

/**
 * One entry per class of disclosure. `id` is what gets printed, `why` explains
 * the class to whoever has to act on a finding.
 */
const PATTERNS = [
  {
    id: 'home-path',
    why: 'absolute path into a local home directory',
    re: /(?:\/Users|\/home)\/[A-Za-z0-9._-]+\//,
  },
  {
    id: 'workspace-path',
    why: "maintainer's workspace directory",
    re: /~\/Projects/,
  },
  {
    id: 'local-port',
    why: 'service bound to a port on the developer machine',
    re: /localhost:\d{4,5}/,
  },
  {
    id: 'ip-address',
    why: 'bare IPv4 address',
    re: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  },
  {
    id: 'anthropic-key',
    why: 'Anthropic API key',
    re: /sk-ant-[A-Za-z0-9_-]{20,}/,
  },
  {
    id: 'generic-key',
    why: 'API key',
    re: /sk-[A-Za-z0-9]{32,}/,
  },
  {
    id: 'inline-secret',
    why: 'secret assigned inline',
    re: /[A-Z0-9_]*(?:KEY|TOKEN|SECRET)\s*[:=]\s*\S/,
  },
];

/**
 * Deliberately tiny. The environment template exists to show which variables
 * have to be set, so it necessarily contains lines that look like assignments
 * to a secret. Its values are placeholders, not credentials — which is why the
 * key-shaped patterns are still enforced there.
 *
 * Nothing else belongs here until it is proven harmless.
 */
const ALLOWED = new Map([['.env.example', new Set(['inline-secret'])]]);

const NO_EXEMPTIONS = new Set();

/** The one name read from the machine instead of written down. */
const MACHINE_USER = basename(homedir() || '');

const MACHINE_USER_RE =
  MACHINE_USER.length > 0
    ? new RegExp(MACHINE_USER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    : null;

function trackedFiles() {
  const stdout = execFileSync('git', ['ls-files', '-z'], {
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.toString('utf8').split('\0').filter(Boolean);
}

function main() {
  let files;
  try {
    files = trackedFiles();
  } catch {
    console.error('leak-check: not a git repository, or git is unavailable.');
    process.exit(1);
  }

  const findings = [];
  let scanned = 0;

  for (const file of files) {
    let buffer;
    try {
      buffer = readFileSync(file);
    } catch {
      // Deleted, unreadable, or a broken symlink. Nothing to scan, move on.
      continue;
    }

    // A NUL byte means binary. Skip silently rather than reporting noise.
    if (buffer.includes(0)) continue;

    scanned += 1;
    const exempt = ALLOWED.get(file) ?? NO_EXEMPTIONS;
    const lines = buffer.toString('utf8').split(/\r?\n/);

    lines.forEach((text, index) => {
      const line = index + 1;

      for (const pattern of PATTERNS) {
        if (exempt.has(pattern.id)) continue;
        if (pattern.re.test(text)) {
          findings.push({ file, line, id: pattern.id, shown: text.trim().slice(0, 100) });
        }
      }

      // Reported without the matched text: printing it would put the name into
      // the build log, which is the disclosure this check exists to prevent.
      if (MACHINE_USER_RE !== null && MACHINE_USER_RE.test(text)) {
        findings.push({ file, line, id: 'machine-user', shown: '(redacted)' });
      }
    });
  }

  if (findings.length === 0) {
    console.log(`leak-check: ${scanned} files scanned, clean.`);
    return;
  }

  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} [${finding.id}] ${finding.shown}`);
  }

  console.error('');
  console.error(
    `leak-check: ${findings.length} finding(s) across ${scanned} files scanned.`,
  );
  console.error('');
  console.error(
    'Do NOT resolve a failure by adding the offending word to the allow list in',
  );
  console.error(
    'this file. The list would then spell out, in a public repository, exactly',
  );
  console.error(
    'what was worth hiding — that is how the leak actually happens. Remove the',
  );
  console.error(
    'value from the file instead, and if a real credential was exposed, rotate',
  );
  console.error('it: deleting a committed secret does not make it secret again.');
  process.exit(1);
}

main();
