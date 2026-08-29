# Support Triage Agent — micro1 Agentic Workflows Hackathon

Single-person support desk triage: decide **what the operator reads first**, and
hold back anything that must not be answered automatically.

> Status: scaffolding. Baseline, evaluation set and results are being added.
> This README will carry the user, the bottleneck, the Improvement Changelog
> and the hot take before submission.

## Setup

```bash
cp .env.example .env   # only needed for live runs
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
yarn validation    # tsc --noEmit, eslint, prettier --check
yarn test          # unit tests
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
