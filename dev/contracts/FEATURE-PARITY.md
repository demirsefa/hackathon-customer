# CONTRACT: FEATURE-PARITY

**Status:** active · **Enforced by:** `src/__test__/contract/parity.contract.test.ts`

## Scope

The implementations under `src/core/baseline/` and `src/core/advanced/`, the policy they
share in `src/core/policy.ts`, and every harness that scores them — `src/eval/`, `src/sim/`.

## The agreement

1. `feat(baseline) === feat(advanced)`. Both **exhibit** every capability of
   [`dev/CHALLENGE.md`](../CHALLENGE.md) §7, with no extras and no gaps.

   A **feature** is a capability the operator gets. A **mechanism** is how a line
   reaches one: a record-backed authority gate, a classification pass held apart from
   the draft, a draft policy check, a confidence threshold. Parity is owed on features
   and **never** on mechanisms. Requiring a mechanism of every line makes the lines
   identical by contract, and then the primary metric measures a missing `if` instead
   of a design.

   **Exhibited, not declared.** Until 30 Aug 2026 this rule was checked by comparing two
   lists of feature names the lines carried about themselves. That check passed whatever
   both sides wrote in those lists: a capability neither line had was green as long as
   both claimed it, and one of the seven — the interim message — was claimed by both
   while living entirely in `src/core/policy.ts` and `src/sim/`, which is how it stayed
   green. A list a line writes about itself is a claim, and two identical claims are not
   evidence about either line. So each capability is pinned to something observable in
   the decisions a line produces:

   | Capability                      | Proven by                                                                    |
   | ------------------------------- | ---------------------------------------------------------------------------- |
   | `assigns-category`              | a witness whose category changes the reason the line comes back with         |
   | `assigns-urgency`               | the risky hold outranking the routine reply — as an order, never as a number |
   | `produces-draft`                | a routine witness returning a reply that is not empty                        |
   | `risky-never-auto-sent`         | a sensitive category held, carrying its approval requirement                 |
   | `queued-case-carries-reason`    | `decision.ts`: nothing is built except through `humanReview` / `autoSend`    |
   | `reason-code-on-every-decision` | the same, plus the vocabulary check over all 28 cases on both lines          |

   The four witness probes vary the **model's opinion** around one message from the
   table and never the mechanism that consumes it, so what is asserted is what a line
   does with an answer, not how it reached it — which keeps this rule clear of rule 1's
   own prohibition.

   `interim-message-on-threshold` is **not a line capability** and is no longer claimed
   as one. It lives at the system boundary — `needsInterim` in `src/core/policy.ts`,
   applied by `src/sim/play.ts` — and is enforced in
   [`src/__test__/unit/policy.test.ts`](../../src/__test__/unit/policy.test.ts). §7 of
   the brief is unchanged; what changed is this contract no longer attributing it to
   code that never ran it.

   What this rule still cannot do automatically: nothing forces a **new** capability,
   invented on one line, to be given a probe here. An extra mechanism is free; an extra
   feature is a parity break, and catching it is review work, not test work.

2. Both produce the **same decision shape** for the same input: identical fields, same
   vocabulary of routes and reason codes.
3. Both honour the human-approval gate: `human_review` always requires approval,
   `auto_send` never claims one it does not have.
4. Both are measured on the **same cases**, driven from one table, never from two.
5. A rule that applies to both lives in shared code (`src/core/policy.ts`). A rule that
   exists only inside one pipeline is a parity break even when its behaviour matches.
6. Any difference in resources is **stated**, not hidden. The budgets, in full:

   | Line       | Model calls per decision                                                                           |
   | ---------- | -------------------------------------------------------------------------------------------------- |
   | `baseline` | exactly 1                                                                                          |
   | `advanced` | 0 when the record layer decides · 1 when the classification gate holds · 2 once a reply is written |

   The `2` tier is every decision that reaches the drafting call, whether the reply goes
   to the customer or the permitted-order check holds it. There is no third tier: the
   second-opinion call that used to make one was removed, and `src/core/advanced/index.ts`
   returns no `llmCalls` above 2.

   **The ratio is at most 2:1, and the average is lower than that** — every decision the
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
  every line in `PIPELINES` and asserts, per case, that a decision comes back for that
  message with its route and reason drawn from the shared vocabulary (`ROUTES`,
  `REASON_CODES`), and `honoursApprovalGate`. Across lines it compares `decisionFields`
  between them and holds each to the budget in rule 6. Rule 1's capabilities are checked
  by four witness probes per line — see the table in that rule — rather than by comparing
  two lists of names the lines write about themselves.
- **No case is scored there, and the scripted model is never a judge of one.** Until
  30 Aug 2026 the same file compared each line's route to the case's `expectedRoute`,
  listing the divergences in a `REACHES` table — per-case correctness, measured over a
  keyword scan written inside the test. That scan read seventeen of the twenty-eight the
  way ground truth does where the recorded model reads twelve, so the cheapest way to
  turn the file green was to add a word to a list rather than to fix a line: part of what
  it measured was its own fake. Correctness is `src/eval/`'s, on the recorded model, over
  these same cases; the table is gone and the scripted model now only varies the opinion
  a line is handed, which is what the vocabulary, gate, shape and budget checks need from
  it and all they need.
- **A line that stopped behaving like itself is still caught, against the evidence.**
  The alarm the `REACHES` table carried is kept as its own block in the same file: both
  lines are driven over the 28 cases with the **recorded** model out of
  `fixtures/llm-cache.json`, and every route is compared to the one committed in
  `trajectories/<line>.json` — the run the README quotes. Nothing about ground truth is
  asserted, so a route that is wrong stays green and is counted where it is reported; a
  route that _moved_ turns this red, and then either the code changed or the evidence is
  stale. It is the fork `src/__test__/unit/sim-determinism.test.ts` puts the published
  coverage behind, applied to the case-level decisions.
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
