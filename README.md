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

## Prior work and attribution

The working conventions in this repository — the contract-document format and
the local validation-gate approach — are adapted from work that existed before
this competition: <https://github.com/demirsefa/flowpad-anchor>.

Everything else — the triage pipeline, the evaluation set, the scenarios and
the results reported here — was written during the hackathon.

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
