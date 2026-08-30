# Support Triage Agent — micro1 Agentic Workflows Hackathon

Single-person support desk triage: decide **what the operator reads first**, and
hold back anything that must not be answered automatically.

> Status: the code produces numbers; the README does not yet report them. The baseline
> line, the evaluation set, the recorded model responses and the scenario player are all
> in, and both `yarn eval --replay` and `yarn sim overload --replay` run on a clean
> machine with no API key. What is still missing is prose: the user and the bottleneck,
> the Improvement Changelog, the results table and the hot take, all of which this file
> will carry before submission.
>
> **The advanced line is still a placeholder** (`src/core/advanced/`), so every
> comparison in this project currently has one column in it, and part of
> [`dev/contracts/FEATURE-PARITY.md`](dev/contracts/FEATURE-PARITY.md) is suspended in
> the open until it lands.

## Running it

Node 22.18 or newer, and nothing else installed by hand. The sources are TypeScript
and Node runs them directly, so an older Node cannot start them at all. Yarn 4 comes
with the repository — `packageManager` in `package.json` pins the version.

```bash
yarn install
yarn eval --replay
```

`yarn eval --replay` scores the 28 evaluation cases against the model responses
recorded in `fixtures/llm-cache.json`. It opens no connection, needs no API key and
costs nothing, which is why it is the form quoted everywhere here. Around 20 seconds
for the install and 3 for the run.

| Command                      | What it does                                       | Needs a key |
| ---------------------------- | -------------------------------------------------- | ----------- |
| `yarn eval --replay`         | scores the evaluation set from the committed cache | no          |
| `yarn eval --live`           | the same run against the real model, recording it  | yes         |
| `yarn sim overload --replay` | plays the overload scenario — the primary metric   | no          |
| `yarn serve`                 | the HTTP surface and the approval queue            | no          |

Each of them takes `--live` or `--replay` and nothing else, and `--help` prints its
usage line. Typed bare at a terminal they ask which mode to run; piped or in CI they
replay, so an unattended run never waits on a question nobody is there to answer. The
rule, and why the flagged form is the documented one, is in
[`src/cli/README.md`](src/cli/README.md).

A key is only ever needed for `--live`:

```bash
cp .env.example .env   # then put ANTHROPIC_API_KEY in it
```

## Branches

One branch: `main`. Nothing is developed on a side branch, so the history reads
top to bottom in the order the work actually happened, one commit per step. A
reviewer checking a claim against the code can walk `git log` from the bottom
without reconstructing a graph first.

## Sources

Everything below existed before this competition, in
<https://github.com/demirsefa/flowpad-anchor>, and is used here with its origin
recorded file by file. The same pins are repeated next to the material itself, in
[`dev/GUIDES.md`](dev/GUIDES.md) and [`dev/contracts/README.md`](dev/contracts/README.md).

| What is used here                                         | Upstream file                                                                           | Pinned at                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Code principles, quoted in `dev/GUIDES.md`                | <https://github.com/demirsefa/flowpad-anchor/blob/main/principles/CODE-PRINCIPLES.md>   | `demirsefa/flowpad-anchor@66e9efc`, 2026-08-28 |
| TypeScript guide, quoted in `dev/GUIDES.md`               | <https://github.com/demirsefa/flowpad-anchor/blob/main/guides/typescript.md>            | `demirsefa/flowpad-anchor@66e9efc`, 2026-08-28 |
| React guide, quoted in `dev/GUIDES.md`                    | <https://github.com/demirsefa/flowpad-anchor/blob/main/guides/react.md>                 | `demirsefa/flowpad-anchor@66e9efc`, 2026-08-28 |
| Contract structure — anchored plus enforced (§3)          | <https://github.com/demirsefa/flowpad-anchor/blob/main/protocol/AGENT-INIT.md>          | `demirsefa/flowpad-anchor@66e9efc`, 2026-08-28 |
| Contract template, copied to `dev/contracts/_TEMPLATE.md` | <https://github.com/demirsefa/flowpad-anchor/blob/main/protocol/contracts/_TEMPLATE.md> | `demirsefa/flowpad-anchor@66e9efc`, 2026-08-28 |
| Contract index, adapted in `dev/contracts/README.md`      | <https://github.com/demirsefa/flowpad-anchor/blob/main/protocol/contracts/README.md>    | `demirsefa/flowpad-anchor@66e9efc`, 2026-08-28 |

Everything else — the triage pipeline, the evaluation set, the scenarios and the
results reported here — was written during the hackathon.

## Checks

```bash
yarn check         # validation and the tests together, about 30 seconds
yarn validation    # tsc --noEmit, eslint, prettier --check
yarn test          # unit tests, and the checks that enforce dev/contracts/
yarn security      # leak-check and secretlint
```

`yarn security` runs two scanners that cover different things, which is why
both are here:

- **`scripts/leak-check.cjs`** — written for this repository. It matches the
  _shape_ of a disclosure rather than any list of private words, so the file
  itself gives nothing away. It covers local home paths, workspace paths,
  localhost ports, bare IP addresses, inline secret assignments, Anthropic API
  keys, and the account name of whoever is running it (read from the machine at
  runtime, never printed on a match).
- **secretlint** — the recommended preset, for well-known credential formats
  from other providers.

They are not redundant. secretlint's recommended preset does not flag an
Anthropic API key, which is the one credential this project actually uses;
leak-check does. Conversely secretlint knows provider formats that no
hand-written pattern set should try to keep up with.

Both run on every commit through lefthook.
