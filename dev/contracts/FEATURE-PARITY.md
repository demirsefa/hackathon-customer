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
6. Any difference in resources is **stated**, not hidden. The budgets, in full:

   | Line       | Model calls per decision                                                                                                                                  |
   | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `baseline` | exactly 1                                                                                                                                                 |
   | `advanced` | 0 when the record layer decides · 1 at the classification gate · 2 when the draft fails the permitted-order check · 3 for a reply that reaches a customer |

   **The ratio is at most 3:1, and the average is lower than that** — every decision the
   record gate makes costs nothing, and those are the cases the comparison turns on. Both
   halves have to be said: quoting the ceiling alone overstates what the line spends, and
   quoting the average alone hides what it is allowed to spend. Any result reported
   anywhere else carries this ratio with it.

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
  every line in `PIPELINES` and asserts, per case, that the decision's route and reason
  come from the shared vocabulary (`ROUTES`, `REASON_CODES`), that it lands where that
  line's own design lands, and `honoursApprovalGate`. Across lines it compares
  `decisionFields` between them and holds each to the budget in rule 6. It also asserts
  every line declares exactly `REQUIRED_FEATURES`.
- Red here means the headline comparison has stopped measuring design and started
  measuring a missing feature.
- Rules 5 and 7 are **judgment**: structure and code quality are checked by the audit
  prompt below, not by the test.
- **The suspension is over, and one of its three lines was wrong.** While
  `src/core/advanced/` was a placeholder, three assertions had nothing to compare and were
  named here as suspended. Two are back as they were written. The first was
  **misdescribed**: it was recorded as "the same route and reason code on both sides of
  each case", which is not what rule 2 says and never was. Rule 2 asks for "identical
  fields, same vocabulary of routes and reason codes" — a shared vocabulary, not a shared
  verdict.

  Per-case route equality would have been a rule that makes the two lines agree by
  contract, and a comparison between two lines that are required to agree measures
  nothing. The lines are _supposed_ to diverge on cases; that divergence is the primary
  metric. What they may never diverge on is the words they express a decision in.

  So the correction is to the note, not to the contract: nothing here has been relaxed,
  and the assertion that now runs is the one rule 2 always stated.

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
