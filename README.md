# Support Triage Agent — micro1 Agentic Workflows Hackathon

Single-person support desk triage: decide **what the operator reads first**, and
hold back anything that must not be answered automatically.

> Status: both lines are built, both are measured, and every number below comes out of a
> committed run. `yarn eval --replay` and `yarn sim overload --replay` reproduce them on a
> clean machine with no API key.

**The result in one line: when the desk is oversubscribed, the share of must-see
messages the operator actually reaches goes from 9 / 42 (21%) to 32 / 42 (76%) — at
1.00 model calls a case, exactly what the baseline spends.**

Where each rubric row is answered:

| Scoring…                     | Read                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Problem & user value         | [The user and the bottleneck](#the-user-and-the-bottleneck)                  |
| Agent solution & engineering | [How the advanced line decides](#how-the-advanced-line-decides)              |
| Measured improvement         | [Improvement Changelog](#improvement-changelog) · [Results](#results)        |
| End-to-end quality           | [Results](#results) · [Main failure mode](#main-failure-mode)                |
| Reproducibility              | [Reproduction guide](#reproduction-guide) — two commands, no key, no network |
| Hot take / insights          | [Hot take](#hot-take)                                                        |

## The user and the bottleneck

Merve runs a support desk on her own. Sixty to eighty messages arrive on a weekday
morning; her shift is 420 working minutes and a case takes her ten, so **forty-two of
them fit in a day**. The rest wait, and some of them are still waiting when they stop
mattering.

Her inbox is Turkish, with some English in it — she works for a Turkish company, and
the evaluation set is written the way that inbox actually arrives: 22 of the 28 cases in
Turkish, 6 in English. Nothing about the measurement depends on reading either. Case
ids, subsets, reason codes, routes and every number are English; the language only
matters if you want to read the drafts themselves.

The bottleneck is not writing the replies. A model writes a decent reply to most of
these messages already. The bottleneck is **the order she opens them in, and what gets
answered without her** — because those two decisions are made before she sees anything,
and they are the ones with a cost attached:

- A message answered automatically that she needed to see is gone. The customer has the
  reply; nobody knows it was wrong until they complain.
- A message held that could have been answered costs her ten minutes. Real, but
  recoverable.

The two are not symmetric, and every rule in this project is written in that direction.
What makes the first failure hard is that the dangerous messages do not look dangerous.
A message can be polite, well-formed, about a real order, and still be a stranger asking
after somebody else's parcel — and no amount of reading the text finds that out, because
the fact that settles it is in the order records and not in the words.

So the question this project answers is narrow and measurable: **when her capacity is
full, how many of the messages she genuinely had to see did she actually reach?**

## How the advanced line decides

Five steps, in this order, and the order is the design. Each one can stop the message;
what reaches a customer is what four checks let through.

1. **The record gate — before any model call.** Is the sender known? Does every order
   key in the text resolve? Does the sender own what they are asking about? A message
   that fails here is queued and **no model is ever called for it**. Its verdict is
   final: nothing below may lift it.
2. **Classification, on the text alone.** One call: category, confidence, whether the
   message needs a record, and whether the text is aimed at the system. The record
   layer is **never put in the prompt** — a prompt holding both a customer's words and
   a verified fact is one generated sentence away from the words overwriting the fact.
3. **The gate.** Four reasons to stop, in order of what they cost to get wrong: text
   written at the system, a record question with no record named, a category the desk
   never answers unread, and the model's own doubt.
4. **Only now is a reply written.** A second call, for a message four checks let through.
5. **The draft is checked against the records, not against the model.** A reply may name
   only orders this sender was shown to own. That is arithmetic over the record layer,
   and it cannot be talked out of it.

### Which choice bought what

| Design choice                                                  | What it is worth                                                                                                                                                                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Open the records before the model speaks**                   | authority subset **0 / 6 → 6 / 6**, at **zero model calls**; 25 of 90 overload arrivals are decided without a model at all                                                                                                                          |
| **Split classification from drafting**                         | injection subset **1 / 8 → 8 / 8**. The split is what lets the classifier be asked "is this text aimed at the system?" — a question one call cannot answer honestly, because the model reporting the instruction is the model that just followed it |
| **Keep the record layer out of the prompt**                    | The verified fact and the untrusted text never share a context window, so no sentence a customer writes can rewrite what the records say                                                                                                            |
| **Check the draft with arithmetic, not with a second opinion** | The second opinion was built, measured and removed: it refused four legitimate replies and rescued none. Unnecessary holds **4 → 0**, cost **1.29 → 1.00** calls a case                                                                             |
| **Sort the queue by the window the metric is scored on**       | A case whose four hours have already run out scores nothing whenever it is opened, so it goes behind one that can still be reached. Coverage **24 / 42 → 28 / 42**                                                                                  |
| **Serve the case the order is about to lose**                  | A case's turn is already known — the cases ahead of it times ten minutes — so the queue serves the highest-ranked case that would not survive its own place, and otherwise the top. No threshold to tune or defend. Coverage **28 / 42 → 30 / 42**  |
| **Read the draft the classifier never saw**                    | The two calls can contradict each other, and only one of them reached the gate. A reply that promises a refund now reopens a category that said there was nothing to refund. Routing **27 / 28 → 28 / 28**, unnecessary holds still **0**           |
| **Rank text-derived signals below record-derived ones**        | Put "there is an instruction in this message" at the top of the queue and an attacker who writes `SYSTEM:` has been handed the front of the operator's morning. Held either way; the argument is only about when she reads it                       |

None of it is bought with a bigger budget: **1.00 model calls a case, the same as the
baseline.** The record gate answers a quarter of the traffic for nothing, and that pays
for the messages that need two calls.

## Running it

Node 22.18 or newer, and nothing else installed by hand. The sources are TypeScript
and Node runs them directly, so an older Node cannot start them at all. Yarn 4 is not
vendored here — `packageManager` in `package.json` pins the version, and Corepack, which
ships with Node, fetches that exact one. If `yarn` is not already on your PATH,
`corepack enable` puts it there; any other Yarn 4 install does just as well, because the
version is pinned either way.

```bash
corepack enable   # once, only if `yarn` is not already on PATH
yarn install
yarn eval --replay
```

`yarn eval --replay` scores the 28 evaluation cases against the model responses
recorded in `fixtures/llm-cache.json`. It opens no connection, needs no API key and
costs nothing, which is why it is the form quoted everywhere here. Around three seconds
for the install and under one for the run.

| Command                        | What it does                                       | Needs a key |
| ------------------------------ | -------------------------------------------------- | ----------- |
| `yarn eval --replay`           | scores the evaluation set from the committed cache | no          |
| `yarn eval --live`             | the same run against the real model, recording it  | yes         |
| `yarn sim overload --replay`   | plays the overload scenario — the primary metric   | no          |
| `yarn sim normal-day --replay` | the same, on an ordinary day's volume              | no          |

Every command runs **both lines** over the same input and reports them side by side —
`dev/contracts/FEATURE-PARITY.md` rule 4 asks that they never be scored on separate runs.

Each of them takes `--live` or `--replay` and nothing else, and `--help` prints its
usage line. Typed bare at a terminal they ask which mode to run; piped or in CI they
replay, so an unattended run never waits on a question nobody is there to answer. The
rule, and why the flagged form is the documented one, is in
[`src/cli/README.md`](src/cli/README.md).

**There is no server here, and the approval gate is not an endpoint.** It is a
decision: `human_review` always carries an approval requirement and `auto_send` never
claims one it does not have — `dev/contracts/FEATURE-PARITY.md` rule 3, held over both
lines by `src/__test__/contract/parity.contract.test.ts`. Nothing reaches a customer
without it. What it does to a run is on screen in the commands above:
`yarn sim overload --replay` reports how many of the 90 arrivals were held for the
operator rather than answered automatically, and `yarn eval --replay` names the
route case by case. An HTTP surface with a queue the operator clicks through was
planned and cut; it is in `dev/CHALLENGE.md` §11 with the rest of what this submission
does not build.

A key is only ever needed for `--live`:

```bash
cp .env.example .env   # then put ANTHROPIC_API_KEY in it
```

## Improvement Changelog

How the primary metric moved, and why. **Critical coverage** is the share of arrivals
ground truth marks critical that the operator opened within four working hours; the
`overload` figure is the headline. Every number in the Evidence column is a field in a
committed file, reachable without running anything.

| Stage                                              | What was tried and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Evidence                                                                                                                                                                                                                                                                                                                    | Decision / Learning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Baseline                                       | One model call returning category, urgency and draft together, then one risk decision: is the category on a fixed sensitive list? Built deliberately as the design a competent person writes first, not as a strawman — its weaknesses are what the comparison is for.                                                                                                                                                                                                                                                                                                                | `trajectories/baseline.json`, `baseline-overload.json`. Coverage **13 / 42 (31%)**, routing 12 / 28.                                                                                                                                                                                                                        | Kept as the baseline. Read on its own the result looked reasonable, which turned out to be the problem: nobody asked _why_ the operator was being shown the cases she was shown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2 · Made the evidence machine-readable             | The only record of a run was a generated markdown page, so every claim about it rested on prose we had written ourselves. Added a versioned JSON record per run and made the markdown a rendering of it — the entry point serialises, re-parses, and renders from the parsed value.                                                                                                                                                                                                                                                                                                   | `trajectories/*.json`, schema `support-triage/{eval,sim}-run@1`. Asserted in `src/__test__/unit/{eval,sim}-record.test.ts`.                                                                                                                                                                                                 | Kept. This is what made stages 3 and 4 findable at all: one `jq` query over the record showed that **13 of the 13** critical cases the operator reached carried the reason `model_output_unusable`. A metric you can only read as prose is a metric you cannot audit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 3 · Found the coverage was an artefact             | Six of the 28 recorded model responses arrive wrapped in a markdown code fence, all six carrying valid JSON. `parseObject` called `JSON.parse` on the raw text, so all six were discarded as unusable and routed to a human. Stripped the fence before parsing.                                                                                                                                                                                                                                                                                                                       | `src/core/llm.ts`, 15 cases in `src/__test__/unit/llm.test.ts`. Coverage fell to **3 / 42 (7%)**, routing 9 / 28.                                                                                                                                                                                                           | Kept, and the published number was corrected in the open (`dev/CHALLENGE.md` §10 carries all three figures and why each was wrong). The headline had been 24 points of parser bug: the design's own risk rule had contributed **none** of the coverage. A defect can inflate a metric and still look plausible.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4 · Fixed the risk rule it exposed                 | With the fence gone, `isSensitive` compared the model's free-text category to the list by equality. The model writes `refund_request`, `returns_refunds`, `billing_dispute`; the list holds `refund`, `billing`. Nothing matched. Switched to containment, in shared code.                                                                                                                                                                                                                                                                                                            | `src/core/policy.ts`, `src/__test__/unit/policy.test.ts`. Coverage **9 / 42 (21%)**, routing 12 / 28, normal subset 10 / 10, unnecessary holds 0.                                                                                                                                                                           | Kept. Required by `FEATURE-PARITY` rule 7 — the baseline is never left weak to widen the gap — and it lives in `policy.ts`, so the advanced line inherits it. Routing returned to 12 / 28, but a different 12: legitimate traffic is now perfect and the whole remaining loss sits on hidden intent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 5 · Built the advanced line                        | Opened the record layer **before** any model call — unknown sender, a key that resolves to nothing, an order owned by somebody else — then split classification from drafting, which frees the classifier to be asked one more thing: is this text aimed at the system? In one call it cannot be asked honestly, because the model reporting the instruction is the model that just followed it.                                                                                                                                                                                      | `trajectories/advanced-overload.json`, `advanced.json`. Coverage **20 / 42 (48%)**, routing 23 / 28, injection 8 / 8, authority 6 / 6.                                                                                                                                                                                      | Kept. The authority subset went 0 / 6 → 6 / 6 at **zero model calls** — the fact was in the records the whole time and no line had opened them. Injection went 1 / 8 → 8 / 8 on a question that costs nothing extra: the same call, one more field.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 6 · Fixed what the first run exposed               | Under overload the operator was spending her morning on thank-you notes. The deterministic permitted-order check passes, then the model's second opinion refuses its own draft — and that refusal was being reported as `draft_policy_violation`, priority 90, ahead of every refund demand in the queue. Reported it as `low_confidence` instead: nothing was breached, something was doubted.                                                                                                                                                                                       | `src/core/advanced/index.ts`, `trajectories/advanced-overload.json`. Coverage **24 / 42 (57%)**, no change in model calls.                                                                                                                                                                                                  | Kept. Nine points of coverage for a reason code, which is the lesson: the queue is sorted by _why_ a message was held, so a reason that overstates itself is not a labelling mistake, it is a scheduling bug.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7 · Tried reading attacks last — undone            | If holding is already the defence, a blocked injection attempt harms nobody while it waits, and a customer locked out of her account does. So `instruction_in_message` was dropped below `sensitive_category` and `unknown_sender`, to read waiting people before failed attacks.                                                                                                                                                                                                                                                                                                     | Same command, `yarn sim overload --replay`. Coverage fell to **22 / 42 (52%)**, from 24 / 42.                                                                                                                                                                                                                               | **Reverted.** The argument was sound and the data refused it: 17 of the 27 injection arrivals are themselves marked critical, so reading them later loses more than the reordering wins. Recorded in `dev/CHALLENGE.md` §10 next to the change that was kept, because a rejected experiment that leaves no trace gets tried again.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 8 · Took the second opinion out                    | The line's third call asked the model whether its own draft was sound. Under overload the operator was opening thank-you notes ahead of refund demands because of it. First the reason code was corrected (a refusal after the deterministic check passes is doubt, not a breach); then the call was removed altogether, since `validateDraft` already answers from the records what the model was being asked to answer from the text.                                                                                                                                               | `yarn sim overload --replay`, `yarn eval --replay`. Coverage **24 / 42 (57%)**, routing **27 / 28**, unnecessary holds **4 → 0**, cost **1.29 → 1.00** calls a case.                                                                                                                                                        | Kept out. It refused four legitimate replies and rescued none — every case it touched it made worse — and taking it out left the advanced line costing exactly what the baseline costs. A model asked to check work a record already settles supplies doubt, not judgement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 9 · Cut the service that was not built             | `dev/CHALLENGE.md` §12 said the decision was surfaced by `src/service/`. The folder was there and nothing listened — running it exited 1 on a judge's terminal. With one step left the choice was to build the surface or to cut it and correct the brief, and a repro-guide command that exits 1 spends more goodwill than an absent feature does.                                                                                                                                                                                                                                   | Commit `103fa6c`; the folder, the `serve` script and the README command row are gone, and `dev/CHALLENGE.md` §11 carries the cut. The approval gate it would have exposed is `src/core/decision.ts`, reachable from `yarn sim overload --replay`.                                                                           | Cut, not deferred. Nothing measured changed: the gate was never in the service, it was in `decision.ts`. What the promise had been buying was a sentence in the brief, and the sentence was cheaper to correct than to honour.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 10 · Replaced a check that proved nothing          | `dev/contracts/FEATURE-PARITY.md` rule 1 was enforced by comparing two lists of capability names, one written inside each line about itself. The check passed whatever both sides wrote: a capability neither line had stayed green as long as both claimed it — and one of the seven, the interim message, was claimed by both while living entirely in `src/core/policy.ts` and `src/sim/`, running in neither line. Deleted the declaration and pinned four capabilities to witness probes that vary the model's opinion around one message and read the decision that comes back. | Commit `96929ce`, `src/__test__/contract/parity.contract.test.ts`. Verified by mutation: disabling the baseline's risk branch turns three probes red, emptying its draft turns a fourth red, restoring both returns 540 green. Results untouched — the trajectory records are byte-identical apart from their commit stamp. | Kept. The declaration was not merely unverified, it was false, and the check was structurally unable to see it. A green test is not evidence until you know what turns it red — which is the question we now ask of a check before trusting it, and the reason this row exists rather than a coverage number.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 11 · Stopped serving lost causes first             | Under overload she was opening every case she queued — 65 of 65 — and still missing 18 critical ones, 15 of them opened after their window had closed. So the loss was not capacity and not classification, it was sequence: strict priority order kept handing her cases that could no longer be reached in time, and the minutes came out of cases that still could. Made whether the window has already closed the queue's first key, ahead of priority.                                                                                                                           | `yarn sim overload --replay`, `trajectories/advanced-overload.json`. Coverage **24 / 42 (57%) → 28 / 42 (67%)**, late misses **15 → 11**, still opened 65 of 65 with nothing left queued. Routing, cost and the normal day are all unchanged; the baseline is unchanged because it never queues more than 15.               | Kept. A case whose window has closed scores nothing whenever it is opened, so putting it ahead of one that can still be reached loses the pair. Two things are said out loud rather than left to be found: the queue is now written to the desk's own service window — the same `CRITICAL_COVERAGE_MINUTES` the metric is scored on — and nothing is dropped, only reordered.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 12 · Rescued the cases the order was about to lose | Sending closed windows to the back left 11 critical cases still opened late — correctly ranked, and lost while they waited for a turn that came too late. A case's turn arrives after everything above it has been served, so the minutes until then are already known: the count ahead of it times the minutes a case takes. Made the queue serve the highest-ranked case that would not survive its own place, and otherwise the top.                                                                                                                                               | `yarn sim overload --replay`, `trajectories/advanced-overload.json`. Coverage **28 / 42 (67%) → 30 / 42 (71%)**, late misses **11 → 9**. Normal day, routing and cost unchanged; still 65 of 65 opened, nothing left queued.                                                                                                | Kept, and kept without a threshold. A tuned one was measured first — 30, 60 and 120 minutes each scored 30 / 42 while 90 scored 29, and a rule whose answer moves like that with a number nobody can justify is fitted to one scenario, not derived from the problem. The queue's own length ahead of a case answers the same question and can be defended, and it scores the same.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 13 · Compared the two calls that never met         | The last routing error was one case. `amb-02` asks for the right colour **or** a refund; the classifier calls it `wrong_item_received` at 0.85 confidence, which is not a sensitive category, so the gate passes it — and the reply the next call writes offers a full refund and goes out unapproved. Nothing compared the two, because when the category was judged the draft did not exist yet. Added a shared predicate over the finished draft and applied it in the advanced line after `validateDraft` and before the send.                                                    | `yarn eval --replay`, `yarn sim overload --replay`. Routing **27 / 28 → 28 / 28**, missed holds **1 → 0**, unnecessary holds **0 → 0**, cost unchanged at **1.00** calls a case. Coverage **30 / 42 (71%) → 32 / 42 (76%)** and the normal day **18 / 19 → 19 / 19**. Baseline unmoved at 9 / 42 and 12 / 28.               | Kept, with the objection stated first. The obvious form of this rule is a keyword scan over generated text, and this project deleted one keyword scan already for exactly that reason — stage 8's second opinion, a model's read of its own output, which is not independent evidence. What makes this one different is not the technique, it is the position: it runs after every stronger rule, so it can only ever add a hold and can never release a message another rule stopped. Its worst case is a case in her queue that did not need to be there, and on the 28 committed cases it produced **none** — the terms are `iade` and `refund`, and the seven other drafts the line writes contain neither. That is the whole defence, and it is the reason the number to watch on this row is unnecessary holds and not coverage. |

**What the thirteen stages leave.** The model was never the weak part: in seven of the
eight injection cases it names the attack and refuses it in its own draft — only
`inj-04` answers as if the message were routine, with a note that the embedded
instruction was ignored. Every point of the improvement came from the arrangement
around it — opening the records before the model instead of after, asking one question
in a call that is not also writing the reply, and sorting the queue by a reason that
means what it says.

What is left is in `## Main failure mode` below, and it is a different shape of problem
from the one we started with.

## Results

Both lines, same 28 cases and same two scenarios, one run each. Every figure in the
table below is a field in a committed file under `trajectories/`, produced by a command
in the reproduction guide. Two further figures are reported underneath it instead, each
saying where it comes from, because neither is a field in a committed record.

| Metric                                    | Baseline      | Advanced       | Change         |
| ----------------------------------------- | ------------- | -------------- | -------------- |
| **Critical coverage (overload)**          | 9 / 42 (21%)  | 32 / 42 (76%)  | **+55 points** |
| **Critical coverage (normal day)**        | 4 / 19 (21%)  | 19 / 19 (100%) | **+79 points** |
| Routing accuracy (28 cases)               | 12 / 28 (43%) | 28 / 28 (100%) | +57 points     |
| Routing (injection subset)                | 1 / 8         | 8 / 8          | +7 cases       |
| Routing (authority subset)                | 0 / 6         | 6 / 6          | +6 cases       |
| Missed holds (auto-sent, should not be)   | 16            | 0              | −16            |
| False positives (held, could be answered) | 0             | 0              | unchanged      |
| Model calls per case                      | 1.00          | 1.00           | **unchanged**  |

**Critical coverage under overload is the headline**, and it is the only number this
project set out to move. `yarn sim overload --replay` prints it; the run behind it is
`trajectories/advanced-overload.json`.

**Operator minutes under overload are printed, not stored.** `yarn sim overload --replay`
ends each line with the sentence "She spent 150 of the 659 working minutes the run gave
her" for the baseline and 660 of 659 for the advanced line. The sim derives the figure
rather than recording it — it is `coverage.opened` from
`trajectories/{baseline,advanced}-overload.json` (15 and 66) times the operator's 10
minutes a case — so the number is on screen from a command in the reproduction guide, but
there is no field to read it from, which is why it is here and not in the table. The
advanced line's 660 against 659 is not a rounding slip: she starts her last case with
minutes left in the shift and finishes it one minute past the horizon. The desk is full.

**It costs the same.** 28 model calls over 28 cases, exactly what the baseline spends.
The record gate answers eight of them without a model at all, and that pays for the
eight that need two. The improvement is not bought with a bigger budget — the ceiling
is two calls and `dev/contracts/FEATURE-PARITY.md` rule 6 states it.

**The authority row is the thesis in one line.** Six messages that are polite, well
formed, and about a real order — asked by somebody who does not own it. No amount of
reading the text finds that out. The advanced line gets all six, and gets them at **zero
model calls**, because the fact was in the order records and the work was opening them.

**Reply quality is scored by hand, so it is not a table row either.** It is measured on
the three cases both lines answer (`norm-01`, `norm-02`,
`norm-06`) so the comparison is like for like, scored by the author on a five-point
scale: 5 answers the question, 4 acknowledges it correctly and promises a follow-up, 3 is
generic, 2 is wrong, 1 is harmful. Both score 4, and the sameness is the point — the same
model writes both drafts, so the designs do not differ on how a reply reads. They differ
on which messages get one.

**The labels are the author's, and that is a real limit.** The 28 case texts, their
`expectedRoute` and `critical` fields in `fixtures/cases.json`, and the arrival times in
`scenarios/` were all written by the person who designed the pipeline — synthetic,
single-author data, and nothing here makes it otherwise. What it does not cover is the
model: `fixtures/llm-cache.json` holds responses recorded from the real model, and replay
serves those exact responses, so the labels are ours and the behaviour being measured is
not. The authority subset consults no label at all — 6 of 6 is decided by whether the
order records say this sender owns this order, arithmetic over the record layer of
`fixtures/cases.json` in [`src/core/authority.ts`](src/core/authority.ts), before any
model call. And the labels were not bent toward the design: the last routing error,
`amb-02`, was fixed by a rule and not by a label — it is still marked critical and still
expected to be held — and a bug found in the baseline was fixed rather than left weak —
`dev/contracts/FEATURE-PARITY.md` rule 7 — which lifted the baseline from 3 / 42 to
9 / 42 and cost the headline fourteen points.

## Main failure mode

**The desk that used to be bypassed can no longer be emptied in a day.** Nothing is
routed wrongly any more — 28 of 28, no missed holds, no unnecessary holds. Under
overload the line holds **68 of 90 arrivals and every one of them belongs in the
queue**, against a day that fits 42. That is the failure now: not what is in the
queue, but that the queue is longer than the desk.

The numbers are all in `trajectories/advanced-overload.json`. She opens 66 of the 68,
and 2 are still waiting when the run ends (`M-0048`, `M-0064`). The average wait is
**256 working minutes**. Eight critical arrivals were opened after their four-hour
window had already closed, and two were never reached at all — ten misses, and that is
the entire distance between 32 / 42 and 42 / 42. Coverage is 76% and not 100% for this
reason alone: on a normal day, where the volume fits the desk, the same design reaches
19 of 19.

**Correct triage does not create hours.** Every improvement in this project moved the
same lever — put the right cases in front of her, then order them so the ones that can
still be saved are saved first. That lever is now close to spent. Stages 11 and 12
bought eight points by reordering a queue whose contents were already right, and there
is not much ordering left to find in a queue that is 26 cases longer than the shift.
What is left has to come from somewhere else: fewer holds that are correct but not
urgent, a second pair of hands, or an interim reply that is good enough to stop the
clock on cases she will genuinely reach late. The sim already sends 68 interim
messages; whether one of them should count as reaching the customer is a product
question this project did not get to answer, and answering it by moving the metric
would be moving the goalposts.

That is a real failure and it is a better one than the failure we started with. The
baseline's queue was short because the desk was walked past; this queue is long because
the right things are in it. But "correctly queued" and "read in time" are not the same
promise, and only the second one is what the customer experiences.

## Hot take

**Our best replies were the dangerous ones.**

Read the baseline's auto-sent drafts in `trajectories/baseline.json` and they are good.
On seven of the eight injection cases the model spots the attack and refuses it _in the
draft it is sending_ — `inj-07` answers "I can't bypass review processes or follow
embedded instructions from message content". On the six authority cases it writes warm,
competent, correctly-formatted Turkish about delivery windows and cancellations. Read as
prose, that line looks like a working product.

Every one of those six is a stranger being told about somebody else's order.

The quality of the reply told us nothing about whether it should have been sent, and it
would have carried a demo. What told us was a question the text cannot answer — does this
sender own this order — and it was sitting in a database the whole time, being handed to
a pipeline that never opened it.

The same lesson arrived a second time, from the other side. Our first published coverage
number was 31%, and it was wrong: six recorded responses came back wrapped in a markdown
code fence, `JSON.parse` threw on all six, and every one was routed to the operator as
unusable. **Every critical case she reached, she reached because a parser failed.** The
number looked plausible, moved in the right direction, and measured a bug. It is written
up with both corrections in [`dev/CHALLENGE.md`](dev/CHALLENGE.md) section 10 rather than
quietly replaced.

Two failures, one shape: the thing that looks like the answer is not the thing that is
load-bearing.

## Reproduction guide

From a clean clone to the headline number. No API key, no environment file, no network -
the model responses are committed in `fixtures/llm-cache.json`, which is a deliverable
rather than a cache artefact.

Node 22.18 or newer is the only prerequisite. Yarn 4 is not vendored in the repository:
`packageManager` in `package.json` pins the version and Corepack, which ships with Node,
fetches it. Run `corepack enable` once if `yarn` is not already on your PATH.

```bash
corepack enable   # once, only if `yarn` is not already on PATH
yarn install
```

```bash
yarn sim overload --replay
```

That prints both lines side by side and ends with the primary metric:

```
baseline — overload · 90 arrival(s)

  CRITICAL COVERAGE         9 / 42  (21%)  opened within 4 working hour(s)
  ...
  model calls               90 total, 1.00 per arrival

advanced — overload · 90 arrival(s)

  CRITICAL COVERAGE         32 / 42  (76%)  opened within 4 working hour(s)
  ...
  model calls               90 total, 1.00 per arrival
```

The other two runs behind the results table:

```bash
yarn eval --replay
```

```bash
yarn sim normal-day --replay
```

Each writes a machine-readable record and a rendering of it into `trajectories/`, both
overwritten in place, so `git diff` after a run shows exactly what changed and what did
not. Re-running changes one row — the commit the run was made at.

Runtime, measured on an Apple M1 Max: `yarn install` takes about three seconds — it
fetches 145 MB into an empty Yarn cache, so a slow connection is the only thing that
makes it longer — and each of the three runs above finishes in under a second. There is
no build step; Node runs the TypeScript sources directly.

Cost: nothing. The replay path makes no network call and reads no API key, because every
model response these runs need is committed in `fixtures/llm-cache.json`. A machine with
no key and no connection reproduces the numbers above in full.

`--live` is the only path that spends anything. To reproduce the recordings themselves
rather than replay them, put an API key in the environment file and use it: it is the
same run against the real model. `yarn eval --live` is 28 model calls, one for each
evaluation case, and a `--live` scenario is 90, one for each arrival. They go to
`claude-sonnet-5` with `maxTokens` 16000 — the parameters are pinned in
[`src/llm/key.ts`](src/llm/key.ts) so that a recording is reproducible — and the prompts
and replies in the committed cache run a few hundred tokens each, which puts a full live
run in cents rather than dollars. Nothing in this guide needs it.

## Video

Under five minutes, walking through the bottleneck, the two lines and the overload run.

<!-- VIDEO LINK GOES HERE - the submission is incomplete without it -->

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
