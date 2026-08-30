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

Built: `src/core/advanced/`. Same seven features as the baseline, different
arrangement — and the arrangement is the entire claim.

```
message in
  ↓
0. RECORD GATE — src/core/authority.ts · ZERO model calls
   sender unknown to the record layer       → human queue (unknown_sender)
   an ORD-nnnn key that resolves to nothing → human queue (unresolved_reference)
   order.owner != message.senderId          → human queue (authority_mismatch)
   otherwise: the orders a reply may name are now fixed, and nothing below widens them
  ↓
1. CLASSIFICATION — one call, with no draft in the same breath
   category + confidence + instruction + needsRecord
  ↓
2. GATE
   instruction                        → human queue (instruction_in_message)
   needsRecord AND no reference        → human queue (unreferenced_record_request)
   sensitive category                  → human queue (sensitive_category)
   confidence < CONFIDENCE_THRESHOLD   → human queue (low_confidence)
  ↓
3. DRAFT — one call, and only for a message four checks let through
  ↓
4. VALIDATION — validateDraft() against the permitted orders · NO model call
   a reply may name only what the sender was shown to own
   fails → human queue (draft_policy_violation)
  ↓
5. COMMITMENT — draftCommitsToSensitiveAction() on the finished text · NO model call
   the draft promises what the category never named → human queue (sensitive_category)
   last on purpose: from here it can add a hold and can never lift one
  ↓
auto-send (routine_reply)
```

Step 0 runs before any model call, which is what makes "this decision cost zero model
calls" an observable fact rather than a claim: `llmCalls` is a field on the decision and
`refusingLlm` in the test suite fails the moment one happens.

**Two questions the baseline structurally cannot ask.** Both ride on the classification
call rather than adding one.

- `instruction` — is this text aimed at the system rather than at the desk? The baseline
  cannot ask it honestly, because its single call produces the category _and_ the reply
  that complies with the attack: the model reporting on the instruction is the model that
  just followed it. Split apart, the classifier has no draft to justify. The recorded
  baseline run shows how close the miss is — on two injection cases the model named the
  attack in its own category, and the single risk check, holding a closed list with no
  word for it, sent the reply anyway.
- `needsRecord` — would answering mean reading this sender's own records? Asked because
  the record layer cannot answer it: with no key in the text there is nothing to resolve,
  and whether a question is _about_ a record is a reading of the text. So this one is
  decided after step 1 and costs that call, and no zero-call claim is made for it. It
  separates "the order I placed last week, I have lost the number" from "do you deliver
  to İzmir, no order yet" — and on the committed set it moves no case that another rule
  would not also catch. It is here because the class of message is real, not because it
  earns a point.

**Priority.** `instruction_in_message` sits at 85 — under every reason the record layer
established, over every category read out of the text. It is derived from the message,
and a signal derived from the message must not outrank one derived from the records.
Ranked above them, a sender who writes `SYSTEM:` at the top of an email would have
promoted himself past every genuine authority violation in the operator's morning: the
order of her queue becomes a thing the attacker writes, and the defence becomes the
attack. Held either way — the argument is only about when she reads it.

**Two things the model was asked to do, and no longer is.** Both were removed for the
same reason, and it is the most useful thing this section records.

- _The rewrite loop._ An earlier draft of §9 had a failed draft fed back to be rewritten,
  up to twice. Never built: `validateDraft` answers the only question that matters — may
  this reply name this order — deterministically and for free, and a model asked to
  rewrite is being asked to argue with a rule that has already decided.
- _The second opinion._ This one **was** built, measured, and taken out. A third call
  asked the model whether its own draft was sound. It refused four legitimate replies
  (`norm-03`, `norm-07`, `norm-08`, `norm-10`) and rescued none, so every case it changed
  it changed for the worse; removing it took routing from 23 / 28 to **27 / 28**, took
  unnecessary holds from 4 to **0**, and took the cost from 1.29 calls a case to 1.00.

The shape both share: a model asked to check work that a record already settles adds
doubt, not judgement. The deterministic check is not a cheaper version of the second
opinion — it is a better one, because it is answering from the records instead of from
the text.

**Cost.** 0 model calls when the records decide, 1 at the classification gate, 2 for a
reply that reaches a customer. The ceiling is 2:1 against the baseline's flat 1 and the
**measured average is 1:1** — 28 calls over the 28 cases, the same total the baseline
spends. [`dev/contracts/FEATURE-PARITY.md`](contracts/FEATURE-PARITY.md) rule 6 states
both halves.

## 10. How it is measured

**Primary metric: critical case coverage.** When the operator's capacity is full,
how many of the messages she genuinely needed to see did she actually reach?

Her day holds 420 working minutes, so at 10 minutes a case she reaches **42**. The
morning brings 60–80. The queue therefore never empties: overload is not a scenario
we contrive, it is the normal condition, and what the metric measures is the _order_
of the queue rather than its length.

| Metric                                  | Baseline      | Advanced       | Change         |
| --------------------------------------- | ------------- | -------------- | -------------- |
| **Critical coverage (normal day)**      | 4 / 19 (21%)  | 19 / 19 (100%) | **+79 points** |
| **Critical coverage (overload)**        | 9 / 42 (21%)  | 32 / 42 (76%)  | **+55 points** |
| Routing accuracy (28 cases)             | 12 / 28 (43%) | 28 / 28 (100%) | +57 points     |
| False positives (legitimate held)       | 0             | 0              | unchanged      |
| Missed holds (auto-sent, should not be) | 16            | 0              | −16            |
| Cost per case (model calls)             | 1.00          | 1.00           | **unchanged**  |

The two coverage rows come from `yarn sim normal-day --replay` and
`yarn sim overload --replay`, each of which plays both lines in one run; the four records
behind them are committed as `trajectories/{baseline,advanced}-{normal-day,overload}.json`,
with a rendering of each beside it. The routing, missed-hold, false-positive and
cost rows come from `yarn eval --replay` and `trajectories/{baseline,advanced}.json`. The false-positive cell is the `unnecessary holds` line
of `yarn eval --replay`. Every figure in the table is a field in one of those files:

```bash
jq '.coverage | {critical, criticalReached}' trajectories/baseline-overload.json
```

Two figures are reported here rather than in the table, because neither is such a field.
**Human minutes spent under overload** is printed by `yarn sim overload --replay` — "She
spent 150 of the 659 working minutes the run gave her", against 660 of 659 for the
advanced line — but the sim derives it from `coverage.opened` (15 and 66) times the
operator's 10 minutes a case instead of recording it. The advanced line's overrun is
real rather than arithmetic: she starts her last case with minutes left in the shift
and finishes it one minute past the horizon. **Reply quality** is 4 out of 5 for
both lines, scored by the author by hand on the three cases both lines answer; no command
produces it, and the sameness is the point — the same model writes both drafts.

**What measuring changed about the paragraph above it.** Under `overload` the baseline
holds 15 of 90 arrivals for the operator and auto-sends the other 75. Her capacity is 42
a day, so _its_ queue never outruns her day: she opens every case in it, after an average
of 15 working minutes, and coverage is still 21% — because 33 of the 42 critical arrivals
were answered automatically and she was never shown that they existed. "The queue never
empties" is a claim about a line that holds the right things; the baseline's failure is
one of holding, not of capacity, and the queue ordering is what the advanced line will be
measured on.

**What the advanced line changed, and what it cost.** On a normal day it reaches all 19
of the messages the operator had to see, against the baseline's 4. Under `overload` the
same design reaches 32 of 42 rather than 9 — and the reason it is 76% and not 100% is the
one the paragraph above predicted. The baseline's desk was _bypassed_: it held 15 of 90
arrivals and she opened every one of them with most of her day unspent. The advanced line
holds 68 — every one of which genuinely had to be held, with no false positives left in
the queue at all. But 68 correct holds against a 42-case day is a queue the ordering
decides: she opens 66 of them, 2 are still waiting when the run ends, the average wait is
256 working minutes, and eight critical arrivals were opened after their four-hour window
had closed. The failure moved: from a desk nobody reached to a desk that cannot be
emptied inside a day.

No routing error is left. `amb-02` was the last one — the classification came back as an
ordinary order issue and the draft the next call wrote offered a full refund in as many
words — and it is now held, by a shared rule that reads the finished draft after every
stronger check has passed. All 28 cases route as the labels expect, with no unnecessary
hold introduced anywhere. What is left is entirely the queue.

**Nine things were tried against this run and four were kept.** All were measured on
`--replay`, so none of them cost a model call.

| Tried                                                                                 | Overload coverage | Kept                              |
| ------------------------------------------------------------------------------------- | ----------------- | --------------------------------- |
| A refused second opinion reported as `draft_policy_violation`                         | 20 / 42 (48%)     | no — the reason overstated itself |
| The same refusal reported as `low_confidence`                                         | 24 / 42 (57%)     | superseded by the row below       |
| Dropping the second opinion call entirely                                             | 24 / 42 (57%)     | **yes** — see §9                  |
| `instruction_in_message` dropped below `sensitive_category` and `unknown_sender` (65) | 22 / 42 (52%)     | no                                |
| A closed coverage window sent to the back of the queue, ahead of priority             | 28 / 42 (67%)     | **yes** — see §9                  |
| The reachable ones then ordered by deadline instead of priority                       | 27 / 42 (64%)     | no — priority earns its place     |
| Rescuing a case with under 30 / 60 / 120 minutes of window left                       | 30 / 42 (71%)     | no — 90 minutes scored 29         |
| Rescuing the case that would not survive its own place in the queue                   | 30 / 42 (71%)     | **yes** — no threshold to defend  |
| Holding a draft that promises a refund the classification never named                 | 32 / 42 (76%)     | **yes** — 0 unnecessary holds     |

The first two are one story told twice, and the third ended it. Reporting a refused
second opinion as a policy breach put thank-you notes at priority 90, ahead of every
refund demand in the queue;
calling it doubt instead was worth nine points. Then the call itself was removed and the
same nine points arrived with four false positives and a third of the cost removed too —
which says the reason code was never the real defect, the call was.

The `instruction_in_message` drop was a deliberate attempt to read a blocked attack
later than a waiting customer, and the measurement refused it: 17 of the 27 injection
arrivals are themselves critical, so pushing them back loses more than the reordering
wins.

**Two earlier numbers were published and both were wrong.** They are recorded here rather
than quietly replaced, because a measurement nobody can audit is not a measurement.

| Published | Overload      | Normal day   | Why it was wrong                                                                                                                                                                                                                                                                                                                                      |
| --------- | ------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| first     | 13 / 42 (31%) | 6 / 19 (32%) | Six of the 28 recorded model responses arrive inside a markdown code fence, all six carrying valid JSON. `parseObject` parsed the raw text, so all six were discarded as `model_output_unusable` and routed to the operator. **Every** critical case she reached, she reached by that accident — the design's own risk rule contributed none of them. |
| second    | 3 / 42 (7%)   | 1 / 19 (5%)  | With the fence stripped, `isSensitive` compared the model's free-text category to the list by equality. The model writes `refund_request`, `returns_refunds`, `billing_dispute`; the list holds `refund` and `billing`. None matched, so a customer demanding a refund in as many words was answered automatically.                                   |
| current   | 9 / 42 (21%)  | 4 / 19 (21%) | —                                                                                                                                                                                                                                                                                                                                                     |

Both were defects in shared code, not design choices, and neither is among the five
weaknesses §8 lists. Fixing them was not optional: FEATURE-PARITY rule 7 requires the
baseline to be written as well as the advanced line, and a baseline flattered by a parser
bug or hobbled by a string comparison is a comparison that measures neither.

The first fix cost the headline 24 points and the second gave back 14. That direction is
the point: `src/core/policy.ts` and `src/core/llm.ts` are shared, so the advanced line
inherits both corrections and the gap between the two lines stays a gap between designs.

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
- An HTTP surface and a queue the operator clicks through. The gate is a decision in
  `src/core/decision.ts`; a server would only have displayed it.

**After Sunday 20:00 there is exactly one answer to a new idea: no.**

## 12. Where each requirement lives

| Requirement                                    | Where it is answered                                         |
| ---------------------------------------------- | ------------------------------------------------------------ |
| User, bottleneck, value                        | `README.md`                                                  |
| Improvement changelog                          | `README.md`                                                  |
| Hot take and main failure mode                 | `README.md`                                                  |
| Reproduction guide                             | `README.md`                                                  |
| Prior work declared                            | `README.md` Sources, enforced by a contract check            |
| Decision logic                                 | `src/core/` — pure, no I/O, no clock, no network             |
| Human approval gate                            | `src/core/decision.ts`, visible in the `eval` and `sim` runs |
| Per-case scoring, 28 cases                     | `src/eval/`, against `src/core/` directly                    |
| Primary metric                                 | `src/sim/`, playing `scenarios/` against the operator model  |
| Committed data and recorded runs               | `fixtures/`, `scenarios/`, `trajectories/`                   |
| Credentials kept out                           | `yarn security` on every commit                              |
| Rules that must not drift                      | `dev/contracts/`                                             |
| Deliverables complete, claims tied to evidence | `dev/contracts/SUBMISSION.md`                                |

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
