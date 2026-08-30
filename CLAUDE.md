# CLAUDE.md — Support Triage Agent

Read before writing code in this repository.

## Where the rules live

|                   |                                                      |                                                                                                                                   |
| ----------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Project law**   | [`dev/contracts/README.md`](dev/contracts/README.md) | Contracts. Every rule is anchored in one place and enforced by a check that goes red. Scan the index at the start of a session.   |
| **Code guidance** | [`dev/GUIDES.md`](dev/GUIDES.md)                     | Code principles + TypeScript + React, quoted from `demirsefa/flowpad-anchor`. Guidance, not law; upstream is the source of truth. |
| **The brief**     | [`dev/CHALLENGE.md`](dev/CHALLENGE.md)               | What the competition asks, what we chose to build, how it is measured, and what is out of scope. Read before proposing new work.  |

A contract check going red is not a broken test to repair — read the contract, then
decide. Changing a rule means changing its contract, deliberately and out loud.

A new contract is the user's call. When you think a rule is needed, say so and we
write it together — never open a contract file on your own.

## Folder structure

All source lives under `src/`. Tests and fakes are **not** scattered next to the code
they cover: there is exactly one `__test__/`, at the top of `src/`, and the fakes those
tests share live in it. A second copy anywhere is a mistake.

```text
src/
  types/       the domain vocabulary. Declarations only, erased at compile time.
  core/        pure decision logic. No I/O, no clock, no network. Both pipelines are built from it.
  utils/       small pure helpers more than one area reaches for. Today: the file shape checks.
  llm/         the model clients that implement `core/llm.ts` — replay, live, record. See its README.
  cli/         what every entry point shares about the terminal: loading `.env`, and the menu.
  eval/        scores the evaluation cases against `src/core/` directly.
  sim/         scenario player; produces the primary metric.
  __test__/    every `*.test.ts` in the project.
    unit/      one module or one line at a time.
    contract/  the checks that enforce `dev/contracts/`.
    fakes.ts   the fakes those tests share — scripted and refusing LLM clients.

fixtures/      ┃
scenarios/     ┃ committed data and recorded runs. Not source; stays outside `src/`.
trajectories/  ┃
scripts/       standalone tooling that has to run before anything is installed.
dev/           the brief, the contracts, the code guidance.
```

Where new work goes:

- A module belongs to one of the areas under `src/`. Adding a new one means saying why
  the existing ones do not fit, in that folder's README — `src/llm/README.md` is the
  worked example.
- Its test goes to `src/__test__/unit/<name>.test.ts`, importing across with
  `../../core/…`. A check that enforces a contract goes to `src/__test__/contract/`
  and keeps the `<name>.contract.test.ts` suffix so it reads as law.
- A fake used by more than one test goes to `src/__test__/fakes.ts`. A one-off stub
  stays inside the test that needs it.

## Commands

```bash
yarn check   # typecheck + lint + format + tests
yarn eval --replay   # replays fixtures/llm-cache.json, no API key needed
yarn sim overload --replay
```
