# CONTRACT: SUBMISSION

**Status:** active · **Enforced by:** `src/__test__/contract/submission.contract.test.ts`

## Scope

What a judge receives: `README.md`, the results tables in `README.md` and
[`dev/CHALLENGE.md`](../CHALLENGE.md) §10, the commands in `package.json`, and the
committed evidence under `trajectories/`, `scenarios/` and `fixtures/`.

Not in scope: how the pipelines decide. That is
[`FEATURE-PARITY.md`](FEATURE-PARITY.md), and rules it already owns are referenced
here rather than restated — see rule 8.

## The agreement

1. **The four deliverables exist, each in a named place.** A missing one is filtered
   out before scoring, so a complete-but-modest submission beats an excellent
   incomplete one. `README.md` carries these sections, spelled exactly:

   | Section                          | Deliverable | Answers                                     |
   | -------------------------------- | ----------- | ------------------------------------------- |
   | `## The user and the bottleneck` | 1           | Who has the problem, why solving it matters |
   | `## Improvement Changelog`       | 1           | How the solution evolved, with evidence     |
   | `## Results`                     | 1           | The baseline-versus-solution comparison     |
   | `## Main failure mode`           | 1           | What still breaks                           |
   | `## Hot take`                    | 1           | The lesson from an observed failure         |
   | `## Reproduction guide`          | 2           | Clean environment to the main result        |
   | `## Video`                       | 3           | A link, under five minutes                  |
   | `## Sources`                     | ground rule | What existed before the competition         |

2. **Every command handed to a judge resolves.** A `yarn <name>` inside a fenced
   `bash` block in `README.md`, `CLAUDE.md` or `dev/` names a script that exists in
   `package.json`. A repro guide whose commands do not run is worse than none: it
   spends the judge's goodwill before the project gets a chance.

3. **No blank evidence.** A **results table** — a markdown table whose first header
   cell is `Metric` — never has an empty cell. A value that is not measured yet is
   written as the literal `pending`, so an unmeasured number can never be mistaken
   for a measured one; `pending` counts as unfilled, and a table still carrying one
   at the freeze is a comparison that was never run. Every number in a results table
   is produced by a command named in the Reproduction guide.

4. **One trajectory per agent.** Every line in `PIPELINES` has a file under
   `trajectories/` carrying its name. The brief asks for representative runs of
   _every_ agent used; a line with no trajectory is an agent the judge cannot follow.

5. **Every meaningful iteration has a changelog entry.** The Improvement Changelog is
   a table of `Stage | What was tried and why | Evidence | Decision / Learning`, with
   at least the baseline row and one iteration. Removed experiments get an entry too,
   with what they taught — this is the row the rubric actually rewards.

6. **Prior work is declared, file by file.** Every row of `## Sources` carries an
   upstream URL and a pinned commit. Anything not listed there was written during the
   hackathon, and that sentence stays in the README.

7. **The rubric governs trade-offs.** Work outside the 100 points never precedes work
   inside them — scalability, runtime performance, UI polish and component count are
   named in [`dev/CHALLENGE.md`](../CHALLENGE.md) §3 as things not scored. When two
   pieces of work compete, the tie-break order is Agent Solution → Reproducibility →
   Measured Improvement. The out-of-scope list in §11 is binding, and after the code
   freeze there is one answer to a new idea: no.

8. **A ground rule owned elsewhere is referenced, never copied.** The approval gate is
   FEATURE-PARITY rule 3. The fair baseline and the stated resource difference are
   FEATURE-PARITY rules 1, 6 and 7. Credentials staying out of the submission is
   `yarn security`, wired into `lefthook.yml`. This contract asserts that the wiring
   exists; it does not restate the rule.

## Why

The failure this prevents is not a weak project. It is a good project that scores
badly, and there are exactly three ways that happens:

- A deliverable is missing, and the submission never reaches a judge (rules 1, 4).
- A claim has no evidence behind it. Ground rule 09 asks every claim about results to
  be tied to the evidence submitted; a blank cell in a comparison table is a claim
  with nothing under it, and a table full of blanks reads as a project that did not
  finish measuring (rules 3, 5).
- The judge cannot reproduce the main result — a wrong command, a step that assumes
  this machine. Reproducibility is 15 points and the second tie-break (rules 2, 6).

Rule 7 exists because the expensive mistake in a two-day build is not doing something
badly. It is doing something well that nobody scores.

## Traps

- Writing `yarn evaluate` in the README when the script is `yarn eval`.
- Leaving a results cell blank "until the numbers land", then submitting the table.
- Reporting a number no command reproduces, or one produced by a run that is not
  committed.
- Adding the advanced line and forgetting its trajectory.
- A changelog that records only what worked. The removed experiment is a rubric row.
- Building something outside the rubric because it is the interesting problem.
- Copying a FEATURE-PARITY rule into this file, so the two drift apart later.

## Enforcement

- **Test:** `src/__test__/contract/submission.contract.test.ts`.
  - Rules 2, 6 and 8 are asserted unconditionally — they are true today and going red
    means someone broke them.
  - Rules 1, 3, 4 and 5 describe deliverables that do not exist yet. Until the code
    freeze the check **reports** each missing item as `PENDING` with its rule number
    and fails nothing; from the freeze instant onward the same items are assertions.
    The pending ledger is printed on every run, so the gap is visible rather than
    forgotten.
  - The freeze instant is `2026-08-30T17:00:00Z` — Sunday 30 August, 20:00 in
    Europe/Istanbul, from [`dev/CHALLENGE.md`](../CHALLENGE.md) §2. It is a constant
    in the test file, and `SUBMISSION_NOW` overrides the clock so the post-freeze
    behaviour can be exercised without waiting for it:

    ```bash
    SUBMISSION_NOW=2026-08-31T00:00:00Z yarn test
    ```

  - **This check reads a clock, which no other test here does.** That is a real cost:
    a suite that is green today and red tomorrow with no commit in between. It is
    accepted deliberately, because the alternative is a check that is red for two days
    and teaches the habit of ignoring red — the one disease a contract cannot survive.

- Rule 7 is **judgment**. No test can tell work inside the rubric from work outside
  it; the audit prompt below asks it directly.

## Audit prompt (paste into a fresh agent session)

> Here is the **SUBMISSION** contract: `dev/contracts/SUBMISSION.md`. Read these files:
> `README.md`, `dev/CHALLENGE.md`, `package.json`, `lefthook.yml`, and list
> `trajectories/`, `scenarios/`, `fixtures/`.
> For each numbered rule, decide whether it is currently honoured. For rule 3, check
> every results number against a command in the Reproduction guide that would produce
> it, and against committed evidence. For rule 7, look at the last few commits and say
> whether the work they contain lands inside the rubric of `dev/CHALLENGE.md` §3 or
> outside it.
> Report every suspected violation with `file:line` and the rule number. When unsure,
> report it rather than staying silent — a false alarm is cheaper than a silent breach.
