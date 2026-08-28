# CONTRACT: FEATURE-PARITY

**Status:** active · **Enforced by:** `src/__test__/contract/parity.contract.test.ts`

## Scope

The implementations under `src/core/baseline/` and `src/core/advanced/`, the policy they
share in `src/core/policy.ts`, and every harness that scores them — `src/eval/`, `src/sim/`.

## The agreement

1. `feat(baseline) === feat(advanced)`. Both declare `REQUIRED_FEATURES`, with no extras
   and no gaps.

   A **feature** is a capability the operator gets — the seven of
   [`dev/CHALLENGE.md`](../CHALLENGE.md) §7. A **mechanism** is how a line reaches one:
   a record-backed authority gate, a classification pass held apart from the draft, a
   draft policy check, a confidence threshold. Parity is owed on features and **never**
   on mechanisms. Requiring a mechanism of every line makes the lines identical by
   contract, and then the primary metric measures a missing `if` instead of a design.

2. Both produce the **same decision shape** for the same input: identical fields, same
   vocabulary of routes and reason codes.
3. Both honour the human-approval gate: `human_review` always requires approval,
   `auto_send` never claims one it does not have.
4. Both are measured on the **same cases**, driven from one table, never from two.
5. A rule that applies to both lives in shared code (`src/core/policy.ts`). A rule that
   exists only inside one pipeline is a parity break even when its behaviour matches.
6. Any difference in resources is **stated**, not hidden. Today there is one line: the
   baseline, at one model call per decision. When the advanced line lands, its budget
   and the ratio between the two are written here, in this rule, before the results are
   reported anywhere else.
7. The baseline is written as well as the advanced pipeline. Its code quality is never
   weakened to widen the gap.

## Why

The primary metric of this project is the difference between the two implementations. If
that difference comes from a feature one has and the other lacks, the measurement is
meaningless — it reports a missing `if`, not a better design.

The hackathon brief requires a fair baseline explicitly, and any meaningful difference in
resources has to be stated rather than hidden, because an advanced pipeline that simply
spends more is a different claim from one that decides better.

## Traps

- Adding a capability to advanced and forgetting to add it to the baseline.
- Weakening the baseline's code quality to widen the gap.
- Giving the two different evaluation cases, or scoring them on different runs.
- Letting a good idea live only in advanced because it feels too clever for a baseline.
- Fixing a bug in one pipeline and leaving the same bug in the other.
- Growing the model-call budget of advanced without saying so in the results.

## Enforcement

- **Test:** `src/__test__/contract/parity.contract.test.ts` — runs one case table through
  every line in `PIPELINES` and asserts, per case, the expected reason code, the shared
  decision shape (`decisionFields`) and `honoursApprovalGate`. It also asserts every line
  declares exactly `REQUIRED_FEATURES`.
- Red here means the headline comparison has stopped measuring design and started
  measuring a missing feature.
- Rules 5 and 7 are **judgment**: structure and code quality are checked by the audit
  prompt below, not by the test.
- **Partly suspended, in the open.** `src/core/advanced/` is a placeholder, so `PIPELINES`
  holds one line and the cross-line half of this contract has nothing to compare. Three
  assertions are therefore not running:

  1. the same route and reason code on both sides of each case (rule 2);
  2. `decisionFields` compared between the lines rather than against a fixed list (rule 2);
  3. the model-call budget as a ratio rather than a single line's number (rule 6).

  They are named in the test file's header as well, and they come back in the same commit
  as the advanced line. A contract is suspended out loud or not at all — quietly dropping
  an assertion and leaving the file green is the failure this note exists to prevent.

- When `src/eval/` lands, it drives every line from the same case list. A harness that
  scores only one of them, or scores them on different inputs, breaks rule 4.

## Audit prompt (paste into a fresh agent session)

> Here is the **FEATURE-PARITY** contract: `dev/contracts/FEATURE-PARITY.md`. Read these
> files: `src/core/pipeline.ts`, `src/core/baseline/`, `src/core/advanced/`, `src/core/policy.ts`,
> `src/core/decision.ts`, `src/eval/`, `src/sim/`.
> For each numbered rule, decide whether it is currently honoured — in particular whether
> any capability, threshold or bug fix exists on one side only, and whether the baseline
> reads like code someone was trying to make good.
> Report every suspected violation with `file:line` and the rule number. When unsure,
> report it rather than staying silent — a false alarm is cheaper than a silent breach.
