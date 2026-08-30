# Support Triage Agent — micro1 Agentic Workflows Hackathon

Single-person support desk triage: decide **what the operator reads first**, and
hold back anything that must not be answered automatically.

> Status: the code produces numbers and the changelog below reports how they moved. The
> baseline line, the evaluation set, the recorded model responses and the scenario player
> are all in, and both `yarn eval --replay` and `yarn sim overload --replay` run on a
> clean machine with no API key. What is still missing is prose: the user and the
> bottleneck, the results table, the hot take, the reproduction guide and the video, all
> of which this file will carry before submission.
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

## Improvement Changelog

How the primary metric moved, and why. **Critical coverage** is the share of arrivals
ground truth marks critical that the operator opened within four working hours; the
`overload` figure is the headline. Every number in the Evidence column is a field in a
committed file, reachable without running anything.

| Stage                                  | What was tried and why                                                                                                                                                                                                                                                              | Evidence                                                                                                                                          | Decision / Learning                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Baseline                           | One model call returning category, urgency and draft together, then one risk decision: is the category on a fixed sensitive list? Built deliberately as the design a competent person writes first, not as a strawman — its weaknesses are what the comparison is for.              | `trajectories/baseline.json`, `baseline-overload.json`. Coverage **13 / 42 (31%)**, routing 12 / 28.                                              | Kept as the baseline. Read on its own the result looked reasonable, which turned out to be the problem: nobody asked _why_ the operator was being shown the cases she was shown.                                                                                                                                |
| 2 · Made the evidence machine-readable | The only record of a run was a generated markdown page, so every claim about it rested on prose we had written ourselves. Added a versioned JSON record per run and made the markdown a rendering of it — the entry point serialises, re-parses, and renders from the parsed value. | `trajectories/*.json`, schema `support-triage/{eval,sim}-run@1`. Asserted in `src/__test__/unit/{eval,sim}-record.test.ts`.                       | Kept. This is what made stages 3 and 4 findable at all: one `jq` query over the record showed that **13 of the 13** critical cases the operator reached carried the reason `model_output_unusable`. A metric you can only read as prose is a metric you cannot audit.                                           |
| 3 · Found the coverage was an artefact | Six of the 28 recorded model responses arrive wrapped in a markdown code fence, all six carrying valid JSON. `parseObject` called `JSON.parse` on the raw text, so all six were discarded as unusable and routed to a human. Stripped the fence before parsing.                     | `src/core/llm.ts`, 15 cases in `src/__test__/unit/llm.test.ts`. Coverage fell to **3 / 42 (7%)**, routing 9 / 28.                                 | Kept, and the published number was corrected in the open (`dev/CHALLENGE.md` §10 carries all three figures and why each was wrong). The headline had been 24 points of parser bug: the design's own risk rule had contributed **none** of the coverage. A defect can inflate a metric and still look plausible. |
| 4 · Fixed the risk rule it exposed     | With the fence gone, `isSensitive` compared the model's free-text category to the list by equality. The model writes `refund_request`, `returns_refunds`, `billing_dispute`; the list holds `refund`, `billing`. Nothing matched. Switched to containment, in shared code.          | `src/core/policy.ts`, `src/__test__/unit/policy.test.ts`. Coverage **9 / 42 (21%)**, routing 12 / 28, normal subset 10 / 10, unnecessary holds 0. | Kept. Required by `FEATURE-PARITY` rule 7 — the baseline is never left weak to widen the gap — and it lives in `policy.ts`, so the advanced line inherits it. Routing returned to 12 / 28, but a different 12: legitimate traffic is now perfect and the whole remaining loss sits on hidden intent.            |

**What the four stages leave.** The model is not the weak part: in all 8 injection cases
it names the attack and refuses it in the draft. The loss is entirely in routing — 33 of
42 critical arrivals are still answered automatically, and the sharpest block is the
authority subset at 0 / 6, where the model correctly reads a delivery question and
nobody asks whether the sender owns the order. That is a record-layer question, not a
category question, and it is what the advanced line exists to answer.

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
