# Contracts

The agreements that govern how this project is built. A contract has two halves:
**anchored** (named, in one place) and **enforced** (a check goes red when it breaks).
With only one, it is not a contract — anchored without enforcement is a wish.

Guidance that is _not_ law lives in [`dev/GUIDES.md`](../GUIDES.md).

## Rules for this folder

1. **Never fork an existing rule — promote it and index it.** A second copy is the
   disease this folder exists to cure.
2. New contracts use [`_TEMPLATE.md`](_TEMPLATE.md); the `Enforcement` section is never
   left blank.
3. When a check goes red, read this folder before touching the check. If the rule
   genuinely should change, change the contract deliberately and say so.
4. Verify that the guard **runs**, not that the guard exists. A check nobody executes is
   decoration.

## Index

| Contract                                 | Scope                                                              | Enforced by                            |
| ---------------------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| [`FEATURE-PARITY.md`](FEATURE-PARITY.md) | The baseline and the advanced pipeline expose the same feature set | `src/__test__/parity.contract.test.ts` |

## Sources

| What                                            | Upstream                                                                                | Pinned at                                             |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| This folder's two-halves structure              | <https://github.com/demirsefa/flowpad-anchor/blob/main/protocol/AGENT-INIT.md> (§3)     | `demirsefa/flowpad-anchor@66e9efc`, read 2026-08-28   |
| [`_TEMPLATE.md`](_TEMPLATE.md), copied verbatim | <https://github.com/demirsefa/flowpad-anchor/blob/main/protocol/contracts/_TEMPLATE.md> | `demirsefa/flowpad-anchor@66e9efc`, copied 2026-08-28 |
| This index, adapted                             | <https://github.com/demirsefa/flowpad-anchor/blob/main/protocol/contracts/README.md>    | `demirsefa/flowpad-anchor@66e9efc`, copied 2026-08-28 |

## Running the checks

```bash
yarn test
```

The suite runs on `git push` via `lefthook.yml`; `yarn validation` (typecheck, lint,
format) runs on every commit.
