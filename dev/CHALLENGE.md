# CHALLENGE.md — what the competition asks, and what we chose to build

Two things live here. Sections 1–5 are the competition's rules, restated so nobody
has to reopen the brief mid-session. Sections 6–12 are our answer to them: the
problem we picked, how it is built, and how it will be measured.

When the two disagree, the competition wins. When our own plan disagrees with a
passing impulse at 2am, the plan wins — that is what section 11 is for.

---

## 1. The competition

**micro1 Agentic Workflows Hackathon.** Pick a specific problem you understand,
solve it with agents, and show with evidence that the result improves on how the
task is handled today.

<https://www.hackerearth.com/community/challenges/hackathon/micro1-frontier-engineering-challenge-2026/>

Four questions the brief asks to be answered throughout:

1. Who has this problem?
2. What bottleneck makes it worth solving?
3. Does the agent solve it well?
4. Can another person reproduce the result?

## 2. Timeline

Istanbul time.

| Stage                   | When                     |
| ----------------------- | ------------------------ |
| Kickoff                 | Fri 28 Aug, 18:00 (past) |
| Office hours (optional) | Sat 29 Aug, 17:00, 24:00 |
| Final-day checkpoint    | Sun 30 Aug, 18:00        |
| **Code freeze**         | **Sun 30 Aug, 20:00**    |
| **Submission closes**   | **Mon 31 Aug, 02:59**    |
| Winners announced       | Sun 7 Sep, 20:00         |

Do not build up to the submission time. The last hour is buffer, not working time.

## 3. How it is judged

100 points.

| Criterion                        | Points | The question behind it                                                      |
| -------------------------------- | -----: | --------------------------------------------------------------------------- |
| Problem & User Value             |     15 | Who experiences the bottleneck, and why does solving it matter?             |
| **Agent Solution & Engineering** | **30** | Which design choices helped the agent solve the problem?                    |
| End to End Quality               |     20 | Would the intended user call this high quality, or does it read as a draft? |
| Measured Improvement             |     15 | Which changes actually improved the outcome?                                |
| Reproducibility                  |     15 | Could someone run it from a clean environment and reach the same result?    |
| Hot Take / Insights              |      5 | What did an observed failure teach you?                                     |

**Tie-break order:** Agent Solution → Reproducibility → Measured Improvement.

**Not in the rubric,** and therefore not worth trading time for: scalability,
code readability, runtime performance, UI polish, number of components. The brief
is explicit that purposeful choices matter more than component count.

## 4. Deliverables

All four are mandatory. A missing one is filtered out before scoring, so a
complete-but-modest submission beats an excellent incomplete one.

1. **Code and improvement changelog.** The full project plus the instructions
   that shape each agent. The README introduces the user, the bottleneck and why
   solving it is valuable, then carries a clearly labelled Improvement Changelog
   with one entry per meaningful iteration — including experiments that were
   removed and what they taught. Closes with the main failure mode and the hot take.
2. **Reproduction guide.** Written for someone starting from nothing: setup, the
   exact commands for the solution, the baseline and the evaluation, which data is
   required, what output to expect, versions, approximate runtime and cost.
3. **Video, maximum 5 minutes.** Problem → baseline → one real end-to-end run →
   the final comparison → the changelog → the change that contributed most → one
   experiment that was removed.
4. **Agent trajectories.** Representative runs for every agent: instructions
   through to result, what each tool returned, the feedback that shaped the next
   step, retries, and every human checkpoint.

## 5. Ground rules that shape the build

The full list is in the brief; these are the ones that constrain the code.

- Consequential actions stay inside a sandbox or a simulation, with human
  approval **before** the action happens.
- Any solution that could significantly affect someone keeps a qualified human
  reviewer in the loop.
- Public or synthetic data only.
- **Credentials stay outside the submission.** Enforced here by `yarn security`.
- Every claim about results is tied to the evidence submitted.
- State plainly what existed before the competition. Recorded file by file in the
  README's Sources section.

---

## 6. The problem we chose

**Merve** runs the support desk for a 40-person e-commerce company. Alone. Most
mornings she opens the inbox to 60–80 messages waiting.

**The bottleneck is not writing the replies.** It is that she cannot tell which
message to open first without reading it. A late shipping question costs nothing.
A late refund request costs a customer. In the inbox the two look identical.

**The thesis, in one line:**

> The right decision cannot be made by reading the text. It can be made by
> reading the record.

This was tested before the build started. A strong model recognised the
"bank account change" pattern from the wording alone — and could not answer
"is order #4471 this person's order?", because that fact was never in the prompt
and no amount of reading made it appear.

## 7. The feature set

Identical in both implementations. `feat(baseline) === feat(advanced)` — what
changes between them is the arrangement, never the capability. Enforced by
`dev/contracts/FEATURE-PARITY.md`.

1. Assigns a category.
2. Assigns an urgency.
3. Produces a draft reply.
4. Sends anything risky to the human queue and **never** auto-sends it.
5. Flags queued cases with a stated reason.
6. Sends an interim message when a threshold is passed **and** the operator has
   not looked at it — the decision itself still belongs to her.
7. Every decision carries a reason code.

A measured difference between two systems means nothing if one of them is missing
a feature. That is the whole reason parity is a contract and not a preference.

## 8. Baseline

Deliberately the reasonable simple approach, not a strawman.

Built: `src/core/baseline/`.

```
message in
  ↓
ONE LLM call: category + urgency + draft
  ↓
did it come back in the shape that was asked for?
  ├─ no  → human queue (model_output_unusable)
  └─ yes ↓
is the category on the risky list?
  ├─ yes → human queue (sensitive_category, priority = the model's urgency)
  └─ no  → auto-send (routine_reply)

[separate loop]
pending case: elapsed >= threshold && operator has not looked → interim message,
stays in the queue
```

Its weaknesses are the point of the comparison, and each one is a real design
choice a person would plausibly make:

- The risk decision sits at a single point and depends on the model's category.
- Authority and ownership are read out of the text. The record layer is handed to it,
  like it is to every line, and never opened.
- Category and draft come from the same call, so the model bends the category to
  fit the draft it already wants to write.
- No draft validation.
- No concept of uncertainty: it always decides.

## 9. Advanced

**Not built yet.** `src/core/advanced/index.ts` is a placeholder; what stands there is
the material it will be assembled from — `src/core/authority.ts`, `src/core/policy.ts`,
and the three prompt files beside it.

```
message in
  ↓
1. RISK SCAN (independent of the text)
   - keywords: refund, bank details, payment, cancellation
   - record reference: does it cite an order number?
   - sender: account age, prior message count
  ↓
2. AUTHORITY CHECK (without reading the text) — src/core/authority.ts
   sender unknown to the record layer      → human queue (unknown_sender)
   reference that resolves to nothing      → human queue (unresolved_reference)
   order.owner != message.senderId         → human queue (authority_mismatch)
  ↓
3. CLASSIFICATION (separate pass, no draft pressure)
   category + confidence
  ↓
4. GATE
   risky category OR confidence < CONFIDENCE_THRESHOLD
   → human queue with a reason (sensitive_category | low_confidence), STOP
  ↓
5. DRAFT (safe cases only)
  ↓
6. POLICY VALIDATION — src/core/policy.ts validateDraft()
   fails → feed back, rewrite (max 2)
   still fails → human queue (draft_policy_violation)
  ↓
auto-send (routine_reply)
```

The gate runs before any model call, which is what makes "this decision cost zero
model calls" an observable fact rather than a claim.

## 10. How it is measured

**Primary metric: critical case coverage.** When the operator's capacity is full,
how many of the messages she genuinely needed to see did she actually reach?

Her day holds 420 working minutes, so at 10 minutes a case she reaches **42**. The
morning brings 60–80. The queue therefore never empties: overload is not a scenario
we contrive, it is the normal condition, and what the metric measures is the _order_
of the queue rather than its length.

| Metric                             | Baseline | Advanced | Change  |
| ---------------------------------- | -------- | -------- | ------- |
| **Critical coverage (normal day)** | pending  | pending  | pending |
| **Critical coverage (overload)**   | pending  | pending  | pending |
| False positives (legitimate held)  | pending  | pending  | pending |
| Reply quality (out of 5, by hand)  | pending  | pending  | pending |
| Human time per case                | pending  | pending  | pending |
| Cost per case                      | pending  | pending  | pending |

### Evaluation set — 28 cases

| Subset                         | Count | What it tests                            |
| ------------------------------ | ----: | ---------------------------------------- |
| Normal cases                   |    10 | Baseline behaviour                       |
| Prompt injection               |     8 | Text trying to steer the system          |
| Social engineering / authority |     6 | **Text is legitimate, authority is not** |
| Ambiguous input                |     4 | Resistance to inventing an answer        |

Two constraints on the set:

- It must contain cases the baseline **structurally cannot** catch. Otherwise the
  comparison measures prompt quality rather than design.
- Messages are processed **one at a time**. Handed a batch, a model finds the
  contradiction by comparison — an advantage it will never have in production.

### Operator model

Does not make decisions. Takes whatever is at the top of the queue. Identical for
baseline and advanced; only the queue's length and order differ.

```json
{
  "id": "merve",
  "minutesPerCase": 10,
  "shift": { "start": "09:00", "end": "17:00" },
  "breaks": [["12:00", "13:00"]],
  "workdays": [1, 2, 3, 4, 5],
  "timezone": "Europe/Istanbul"
}
```

`workdays` is ISO: 1 = Monday … 7 = Sunday. `timezone` is required rather than
defaulted, because "09:00" otherwise means whatever the machine producing the number
thinks it means and the run stops being reproducible. A case that arrives on Friday
evening waits until Monday 09:00, and the weekend spends none of its budget.

Modelled in `src/core/operator.ts` as pure functions over an instant passed in:
`isWorking`, `nextWorkingMinute`, `workingMinutesBetween`. Time-to-open is counted in
working minutes, never wall-clock ones.

## 11. Out of scope

Say no to these, including — especially — when they sound like a good idea late
at night.

- Scalability infrastructure (a README paragraph is enough)
- Chat channel (a `channel` field and a paragraph)
- Doctor CLI, stress testing, anomaly detection, operational signals
- UI, apart from a single observation page
- Auth, a database, real email integration

**After Sunday 20:00 there is exactly one answer to a new idea: no.**

## 12. Where each requirement lives

| Requirement                                    | Where it is answered                                        |
| ---------------------------------------------- | ----------------------------------------------------------- |
| User, bottleneck, value                        | `README.md`                                                 |
| Improvement changelog                          | `README.md`                                                 |
| Hot take and main failure mode                 | `README.md`                                                 |
| Reproduction guide                             | `README.md`                                                 |
| Prior work declared                            | `README.md` Sources, enforced by a contract check           |
| Decision logic                                 | `src/core/` — pure, no I/O, no clock, no network            |
| Human approval gate                            | `src/core/decision.ts`, surfaced by `src/service/`          |
| Per-case scoring, 28 cases                     | `src/eval/`, against `src/core/` directly                   |
| Primary metric                                 | `src/sim/`, playing `scenarios/` against the operator model |
| Committed data and recorded runs               | `fixtures/`, `scenarios/`, `trajectories/`                  |
| Credentials kept out                           | `yarn security` on every commit                             |
| Rules that must not drift                      | `dev/contracts/`                                            |
| Deliverables complete, claims tied to evidence | `dev/contracts/SUBMISSION.md`                               |

## 13. The last seven hours

Code freeze is Sunday 20:00. Submission closes Monday 02:59. The seven hours between
them are not extra build time — they are assembly time, and they are planned here
because at 23:00 on the last night nobody plans well.

### What the freeze freezes

Closed at 20:00: `src/`, `fixtures/`, `scenarios/`. Open: README prose, the video,
exporting `trajectories/` (running the code is not changing it), the submission form.

One exception. If the clean-clone rehearsal below finds something that **blocks
reproduction** — a command that does not exist, a missing file, a step that only works
on this machine — it is fixed, in one commit, whose message starts `post-freeze: repro
blocker`. Everything else the rehearsal turns up is written into the README as a known
limit and left alone. A defect that is documented costs a fraction of what a
last-minute change to frozen code costs.

### The plan

| Time (Istanbul) | Work                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| 20:00–20:20     | `yarn check` and `yarn security` green, tag the freeze, note the commit       |
| 20:20–21:10     | Clean-clone rehearsal (below)                                                 |
| 21:10–21:40     | Export the trajectories, one per line                                         |
| 21:40–22:20     | README close-out: results numbers, changelog evidence, failure mode, hot take |
| 22:20–22:50     | Write the video script and read it aloud against a timer                      |
| 22:50–00:20     | Record, two or three takes                                                    |
| 00:20–01:20     | Edit, upload unlisted, put the link in `## Video`                             |
| 01:20–01:50     | Submit                                                                        |
| 01:50–02:59     | Buffer. No work.                                                              |

### The clean-clone rehearsal

Reproducibility is 15 points and the second tie-break, and this is precisely what a
judge does. Clone into an empty directory and follow the README **literally**, not
from memory:

```bash
git clone <repo> && cd <repo>
yarn install
yarn eval --replay
yarn sim overload --replay
```

What it produces, all of which the Reproduction guide then states: the node and yarn
versions, the real duration of each command, the real cost (zero on the replay path —
if `yarn eval --replay` asks for an API key, the repro is broken), and the output a judge should
expect to see.

### The video, five minutes

| Time      | Content                                                                        |
| --------- | ------------------------------------------------------------------------------ |
| 0:00–0:40 | The problem: 60–80 messages, 42 reachable, and no way to order them by reading |
| 0:40–1:20 | The baseline, and one case it structurally cannot catch                        |
| 1:20–3:00 | One real run end to end — **the approval gate on screen**, not described       |
| 3:00–3:50 | The comparison table, critical coverage under overload                         |
| 3:50–4:30 | The change that contributed most, and one experiment that was removed          |
| 4:30–5:00 | The hot take                                                                   |

The two things most often left out are the removed experiment and the human checkpoint.
Both are rubric rows.

### Submitting

Not in one shot at the deadline. Submit as soon as the four deliverables exist, around
01:20, and treat everything after that as revision. A submitted entry that could be
better beats a better entry that missed the form.

Two things to settle **before** Sunday evening, because both take longer than they look:

- **Access.** Ground rule 10 asks that judges can run the project. A private repository
  has to be made public or shared before the form is filled, and that is a deliberate
  decision — the security scanners run on every commit precisely so this one is safe.
- **Whether the platform allows editing a submission.** If it does, submit early and
  revise. If it does not, one submission at 01:20 with a hard stop. This is not
  documented on the public page; it needs a login or a question to the organisers.

## Goal order

1. **A valid submission** — four complete parts, past the filter.
2. **Top 50** — the paid work pool. The realistic target.
3. A placing, if it happens.

When Saturday gets stuck, re-read this list from the top, not the bottom.
