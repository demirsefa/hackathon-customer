# CLAUDE.md — Support Triage Agent

Read before writing code in this repository.

## Where the rules live

|                   |                                                      |                                                                                                                                   |
| ----------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Project law**   | [`dev/contracts/README.md`](dev/contracts/README.md) | Contracts. Every rule is anchored in one place and enforced by a check that goes red. Scan the index at the start of a session.   |
| **Code guidance** | [`dev/GUIDES.md`](dev/GUIDES.md)                     | Code principles + TypeScript + React, quoted from `demirsefa/flowpad-anchor`. Guidance, not law; upstream is the source of truth. |

A contract check going red is not a broken test to repair — read the contract, then
decide. Changing a rule means changing its contract, deliberately and out loud.

New rule? Index it in `dev/contracts/`, never fork it into a second file.

## Layout

- `core/` — pure decision logic. No I/O, no clock, no network. Both pipelines are built from it.
- `service/` — HTTP surface and in-memory queue. Nothing reaches a customer without the approval gate.
- `eval/` — scores the evaluation cases against `core/` directly.
- `sim/` — scenario player; produces the primary metric.
- `fixtures/`, `scenarios/`, `trajectories/` — committed data and recorded runs.

## Commands

```bash
yarn check   # typecheck + lint + format + tests
yarn eval    # replays fixtures/llm-cache.json, no API key needed
yarn sim overload
```
