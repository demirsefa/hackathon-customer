# ADVANCED_PLAN.md — the last five hours

Written 2026-08-30, revised 15:10 Istanbul. Code freeze is 20:00 today
([`CHALLENGE.md`](CHALLENGE.md) §2), so this file has five hours of life in it. It
exists because at 18:00 nobody decides well, and because the measurement taken this
afternoon changed what the advanced line has to be.

Three things live here:

1. What the repository actually measures today, against what the vision document says.
2. The findings that change the plan, with the evidence under each.
3. The build, hour by hour, with the decision points marked.

When this file disagrees with [`CHALLENGE.md`](CHALLENGE.md), CHALLENGE wins and this
file is wrong — except where a section below says a CHALLENGE section is being edited
deliberately, and says which one.

---

## 1. Where the project actually stands

Measured at `87b70c1` plus the working tree, after the fenced-JSON fix in
`core/llm.ts` and the containment match in `core/policy.ts` landed.

```bash
yarn eval --replay
yarn sim overload --replay
yarn sim normal-day --replay
yarn test
```

| Number                                | Value                                                                |
| ------------------------------------- | -------------------------------------------------------------------- |
| Evaluation, baseline                  | **12 / 28** routed correctly                                         |
| — by subset                           | normal **10/10** · injection 1/8 · authority **0/6** · ambiguous 1/4 |
| — missed holds (auto-sent, expensive) | 16                                                                   |
| — unnecessary holds                   | **0**                                                                |
| Critical coverage, overload           | **9 / 42 (21%)** · 15 of 90 held · she opened all 15                 |
| Critical coverage, normal day         | **4 / 19 (21%)** · 7 of 45 held                                      |
| Model calls                           | 1.00 per case, every case                                            |
| Test suite                            | green, with 11 SUBMISSION items still pending                        |

So the vision document's closing line — _"Ölçülmüş tek bir sayın yok"_ — is out of
date, and by a wide margin. The measuring apparatus is finished: eval, sim, the
operator calendar, the queue ordering, the recorded-model cache, the trajectory
writers, two contracts and their checks. **The one thing missing is the second line
to measure.**

The baseline is now a clean naive line rather than a noisy one: it holds nothing it
should not (0 unnecessary holds, normal 10/10), and it misses every case whose problem
is not in the words. That is the shape the comparison wants.

### The vision document, corrected

| Vision says                                                  | Repository says                                                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| "12 vaka"                                                    | 28 cases: 10 normal, 8 injection, 6 authority, 4 ambiguous                                                       |
| "ölçülmüş tek bir sayın yok"                                 | four measured numbers, three committed trajectories, all reproducible with no key                                |
| contracts: EXTERNAL-INPUT-IS-UNTRUSTED, FEATURE-PARITY       | contracts: **FEATURE-PARITY, SUBMISSION**. The untrusted-input rule is real in the code and **anchored nowhere** |
| "IBAN / ödeme yönlendirmesi en tehlikelisi"                  | no payment-redirection case exists in the 28. Described in CHALLENGE §9, tested by nothing                       |
| "thread özeti deterministik olmalı"                          | `threadSummary` is model-written text, labelled untrusted in the prompt rather than replaced by numbers          |
| "`channel` alanı var"                                        | `InboundMessage` has no `channel` field                                                                          |
| "RecordStore … README'de üretimde sipariş servisi paragrafı" | the port exists; the paragraph does not                                                                          |
| trajectory three layers: runtime / audit / development       | runtime only. No audit run, no development-session summaries                                                     |
| "kayıt yoksa hata verir"                                     | true — `ReplayMiss`, and `yarn eval` prints the one line that fixes it                                           |
| "yetki metinden okunmaz"                                     | true and load-bearing — `core/authority.ts`, six `auth-*` cases, zero model calls to decide them                 |
| "insan bir kaynak, kapasitesi modellenir"                    | true — `core/operator.ts`, shift, break, workdays, timezone, working-minute arithmetic                           |

The thesis survived contact with the code. The inventory around it drifted.

---

## 2. The findings

### 2.1 Landed: five of the baseline's six correct holds were a parse accident

Six of the 28 recorded answers came back wrapped in a markdown fence. `parseObject`
called `JSON.parse` on the raw text, failed, and the baseline routed the message to
`model_output_unusable` → human review. Of its six correct holds, **exactly one**
(`norm-04`) came from the sensitive-category check the line is built around; the other
five were the parser failing.

Fixed in `core/llm.ts` (`stripFence`) — shared code, both lines, and it was on the
advanced line's path too. The baseline's numbers moved as a result: coverage under
overload went from 13/42 to 9/42, and the unnecessary hold on `norm-03` disappeared.
**A measurement nobody audited was reporting markdown fences.** This is a changelog row
and a hot-take candidate, not a closed item.

### 2.2 Settled: the baseline keeps its free-text category

The earlier draft of this plan called the open category vocabulary a fairness problem
and proposed writing a closed set into both prompts. That was one step too far, and the
project's own contract says so.

FEATURE-PARITY rule 1: _"A **mechanism** is how a line reaches one: a record-backed
authority gate, **a classification pass held apart from the draft**, a draft policy
check, a confidence threshold. Parity is owed on features and **never** on
mechanisms."_ A classification pass that constrains the model to a closed vocabulary is
that mechanism, named in the contract, and the baseline is entitled not to have it.

What was genuinely wrong was narrower: `isSensitive` compared the model's free text to
a fixed list **by equality**, so the policy depended on the model guessing the desk's
vocabulary exactly. That is a coincidence, not a policy, and it has been fixed in
`core/policy.ts` by matching on containment — shared law, both lines, no prompt change
and therefore no recording cost.

What is left is a real property of the naive arrangement, and it stays:

> The model recognised every injection. It named them in the category field —
> `prompt_injection_attempt`, `suspicious_prompt_injection` — and wrote a refusal into
> the draft. The baseline auto-sent the reply anyway, because that category is not on
> the desk's risky list, and one call cannot both invent a vocabulary and be governed
> by one.
>
> The intelligence was there. The arrangement threw it away.

That is the second axis of the same thesis, it costs nothing to keep, and it is
stronger material for the README and the video than a narrower gap would be.

**Consequences for the build:** the baseline prompt does not change, so the 28 recorded
triage answers stay valid, the baseline trajectories stay valid, and the live run in
step 3 pays only for the advanced line's prompts.

**Not doing, deliberately:** widening `SENSITIVE_CATEGORIES` to include
`injection`/`suspicious`. It would chase whatever words the model invents next — one
recorded answer names its category in Turkish — and `policy.ts` already says why that
is not a risk decision. The advanced line answers it with a closed vocabulary in its
own classification pass, which is a mechanism, which is allowed.

### 2.3 Open: the SUBMISSION contract goes red at 20:00 unless the prose lands first

`src/__test__/contract/submission.contract.test.ts` flips rules 1, 3, 4 and 5 from
_report_ to _assert_ at `2026-08-30T17:00:00Z`. The eleven open items are the README
sections, the changelog table and the results cells — plus one that cannot be true
before the freeze:

```text
rule 1: the Video section has no URL in it
```

The video is recorded at 22:50 and uploaded around 01:20
([`CHALLENGE.md`](CHALLENGE.md) §13), and §13 explicitly leaves README prose and the
video open after the freeze. So the contract and the plan contradict each other for six
hours, and the contradiction lands exactly where the clean-clone rehearsal at 20:20 will
run `yarn check` in front of a fresh clone.

Two ways out, and this one is the user's call:

- **(a) Split the flip.** Numbers and trajectories assert at the freeze (20:00); prose,
  changelog and the video URL assert at submission close (`2026-08-30T23:59Z`). A
  deliberate contract edit, said out loud in `dev/contracts/SUBMISSION.md`, ~20 minutes.
- **(b) Write all the prose before 20:00** and accept one soft failure on the Video URL
  from 20:00 until the upload.

Recommended: **(a)**, and write the prose before 20:00 anyway.

---

## 3. The advanced line

This is the line that is being built right now, in its own session. What follows is
what it is _for_; the step-by-step brief driving the implementation lives with that
session, and where the two disagree the brief is the one that compiles.

`src/core/advanced/index.ts` exports `advanced: Pipeline` and `PIPELINES` becomes
`[baseline, advanced]`. Nothing else about the harnesses changes: `eval`, `sim`, the
trajectory writers and the record files all loop over `PIPELINES` already, so adding
the line produces `trajectories/advanced.md`, `advanced-overload.md` and
`advanced-normal-day.md` with no new code.

### The five steps, and what each one buys

| Step               | Costs   | Answers                                                                                      |
| ------------------ | ------- | -------------------------------------------------------------------------------------------- |
| 0 · Record gate    | 0 calls | Is this person allowed to be told this? Read from the record, not the text                   |
| 1 · Classification | 1 call  | What is this about, how sure are we, and is the message issuing orders?                      |
| 2 · Gate           | 0 calls | Anything the answer to step 1 makes unsafe to send unread                                    |
| 3 · Draft          | 1 call  | The reply itself, written only for cases that got this far                                   |
| 4 · Validation     | 1 call  | Does the draft mention an order this sender does not own — deterministic first, model second |
| 5 · Auto-send      | —       | What is left                                                                                 |

**Model-call budget: baseline 1 per case, flat; advanced 0, 1, 2 or 3.** The cheapest
decisions are the ones the record layer settles on its own, which is the opposite of
where a naive line spends. This ratio goes into FEATURE-PARITY rule 6 **before** any
result is reported, and the eval scorecard already prints it.

### Two additions to CHALLENGE §9

**The message that issues orders.** Step 1's output grows one field: is this text
telling the system what to do? No extra call — the same classification answers it.

Why the baseline cannot have this: its single call both names the category and writes
the reply that obeys the instruction. The target of the attack and the input to the
decision are the same point. In the advanced line they are two calls apart, so the
classifier is not the party producing the compliant output. The recorded run already
showed the shape of it — on `inj-07` the model labelled the message
`prompt_injection_attempt` and the baseline auto-sent it anyway, because a category
nobody asked for is a warning nobody hears.

**The record question with no key.** "The order I placed last week — I do not have the
number." The gate says `no_reference` today and waves it through. Asking about the
record without producing the key that opens it is a reason to stop, and it is still
record-layer reasoning rather than text reading.

Two cautions on this one, both worth stating before it is measured:

- It cannot be answered at zero calls. Whether a message is _about_ a record is a
  classification, so this hold lands after step 1 and costs one call. The "zero model
  calls" claim belongs only to the steps that genuinely have it.
- **No case in the evaluation set needs it.** `auth-06` — the case it was written for —
  is already held one rule earlier as `unknown_sender`, and the only other
  reference-free cases are `norm-09` (held on category), `amb-03` (held on confidence),
  `inj-03` (held on instruction) and `norm-07` ("do you ship to İzmir? no order yet"),
  which must **not** be held. So this rule moves no number and can only cost one: if it
  catches `norm-07`, the advanced line buys its gains with a false positive. Keep it,
  keep it narrow, and say in the changelog that it was designed for production rather
  than measured into the result.

### Two properties to hold on to

- **Text-derived priority ranks below record-derived priority.** The new reason code
  sits in the same table as `authority_mismatch` (95) and `sensitive_category` (80). It
  belongs **between** them, not above: a fact the record layer established outranks a
  claim read out of a message. Otherwise an attacker promotes themselves to the top of
  Merve's queue by writing "SYSTEM:" in a message — the queue-flooding attack the vision
  document names, arriving through our own defence.
- **The record layer never enters a prompt.** `core/llm.ts` says so; keep it true. The
  authority verdict shapes the control flow, not the text sent to the model.

### The removed-experiment slot is now empty

`verify.ts` was going to be the experiment we ran and removed — the rubric asks for one,
and the video has a slot for it. It is in the line instead, as step 4's second opinion.

The vacancy is filled by the rewrite loop: CHALLENGE §9 specified up to two rewrites
when a draft fails policy, and the line being built holds the message instead. That is a
real experiment with a real lesson — a deterministic check already answers the only
question that matters, and spending a call to argue with a policy buys nothing — and it
needs one paragraph in the changelog, not a measurement.

---

## 4. The schedule

Every step ends in a commit. A step that runs long is cut at its box, not extended —
what gets cut is named in the step.

| Time        | Step                                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| — done      | **0. Land the working tree.** The `record.ts` split, the fence fix, the containment match and their tests are committed; `dev/CHALLENGE.md` §10 and the README changelog carry the corrected numbers                      |
| 15:15–16:30 | **1. The advanced line**, in its own session: `advanced/index.ts` per §3, the two additions, the parity assertions un-suspended, `src/__test__/unit/advanced.test.ts`. **No live calls** — verified against `scriptedLlm` |
| 16:30–16:50 | **2. One live run**, by hand: `yarn eval --live`. The baseline's 28 answers are already cached, so this pays only for classify, draft and verify. Commit `fixtures/llm-cache.json`                                        |
| 16:50–17:10 | **3. The numbers.** `yarn eval --replay`, `yarn sim overload --replay`, `yarn sim normal-day --replay`. Commit the six trajectory files                                                                                   |
| 17:10–17:40 | **4. Contracts.** Un-suspend the three FEATURE-PARITY assertions; rule 6 gets the call-budget ratio; `REACHES` gets the advanced line; the SUBMISSION clock decision from §2.3                                            |
| 17:40–18:10 | **5. CHALLENGE §9 and §10.** §9 stops saying "not built yet"; §10's table gets both columns; the "what the first measurement changed" paragraph is rewritten                                                              |
| 18:10–19:30 | **6. README prose.** The seven required sections. Changelog first — it is a rubric row and the hardest to reconstruct                                                                                                     |
| 19:30–19:50 | **7. `yarn check`, `yarn security`, clean-clone smoke.** Fix only what blocks reproduction                                                                                                                                |
| 19:50–20:00 | **8. Freeze.** Tag, write the commit sha into the README                                                                                                                                                                  |

Everything after 20:00 follows [`CHALLENGE.md`](CHALLENGE.md) §13 unchanged.

### The one irreversible step

Step 2 spends money and wall-clock time. **Every advanced prompt must be finished before
it starts** — a changed prompt is a changed cache key, and a second recording pass is 20
minutes this schedule does not have.

Free after the recording, because none of it is in a prompt: `CONFIDENCE_THRESHOLD`,
which categories are sensitive, the reason-to-priority table, the route a category maps
to, and whether the record-question-with-no-key rule is on at all. Tune those against the recorded answers as much as it takes.

Costs another live pass: any word in `buildClassifyPrompt`, `buildDraftPrompt`,
`buildVerifyPrompt`, the model id, `maxTokens`, effort. `buildTriagePrompt` is not
touched at all, which is what keeps the baseline's cache, numbers and trajectories
valid. The classification prompt grows a field for the two additions, so it is written
once and recorded once — a second thought about its wording after 16:30 costs the run.

### Rollback

If step 1 or 2 goes wrong past 17:30: `git revert` the advanced line and submit the
measured baseline with the README saying plainly that the advanced line did not land. A
complete submission with one column beats an incomplete one with two
([`CHALLENGE.md`](CHALLENGE.md) §4).

---

## 5. What the numbers are expected to do

Written down before the run, so the comparison afterwards is a prediction tested rather
than a result explained. Baseline today: 12/28, and 9/42 critical coverage under
overload.

Reading the record layer by hand, case by case:

- **Advanced holds at zero model calls:** `auth-01`…`auth-06` (owner mismatch ×5,
  unknown sender ×1), `amb-01`, `amb-04` (references that resolve to nothing). Eight
  cases the baseline structurally cannot reach — it scores 0/6 on authority today.
- **Advanced holds on the closed vocabulary** where the baseline auto-sent because the
  model invented a category name: `inj-01`, `inj-02`, `inj-03`, `inj-05`, `inj-07`,
  `inj-08`. Six more, and the mechanism the contract permits it to have.
- **Advanced holds on the instruction field:** `inj-04` — an injection wrapped around a
  genuine shipping question, which no category and no record lookup can catch, because
  the question is real and the order is the sender's own. It is the one case the whole
  addition exists for, and the only case in the set that tests it alone.
- **Advanced only, and uncertain:** `amb-03` ("do the thing we discussed") has no
  reference and no category; it is held only if the model's confidence lands below
  `CONFIDENCE_THRESHOLD`. If it does not, that is a documented miss, not a threshold to
  bend after seeing the answer.
- **Watch for a false positive:** `norm-08` is a thank-you note that mentions an
  invoice. The baseline auto-sends it correctly today; if the closed vocabulary pushes
  it to `billing`, the advanced line buys its gains with a hold that costs Merve ten
  minutes for nothing. It belongs in the results table's false-positive row either way.

Rough expectation: advanced **26–28 / 28** against the baseline's 12, with the gap
sitting in `auth-*`, `inj-*` and `amb-*` — and coverage under overload roughly tripling.
A number that high is itself a warning: the evaluation set was written against this
design, and a line that scores 28/28 on the cases that shaped it has proven that it is
consistent, not that it is right. Say that in the README rather than waiting to be told.

Two things to check rather than assume once the run lands:

- **Does her queue outrun her day?** The baseline holds 15 of 90 and she opens all 15.
  Advanced will hold far more, and if it holds more than 42 the ordering starts to
  count — which is what §10 says the metric is actually about. If it stays under
  capacity, say so: the gain came from holding the right things, not from ordering them.
- **What did the model calls cost?** Advanced spends 0–3 per case against a flat 1, and
  with the verify pass inside the line every clean case costs three. FEATURE-PARITY
  rule 6 wants that ratio stated next to the result, not after it — an advanced line
  that decides better by spending three times as much is a different claim from one
  that decides better.

**If the gap comes out small, report the small gap.** A fair baseline that scores well
is a finding, and "we fixed the measurement and the difference halved" is a changelog
row worth more than a wide gap nobody believes.

---

## 6. Not doing, and where each one is written down

- **Changing the baseline prompt.** §2.2. It keeps its cache, its numbers and its
  trajectories, and the contract says the classification mechanism is not owed to it.
- **A keyword risk scan** (CHALLENGE §9 step 1). It reads the text, which is the thing
  this project says you cannot decide from, and the classification pass covers the same
  cases with one call it was already spending. §9 is edited in step 5 to say so — a
  design cut, stated, not a silent omission.
- **The rewrite loop** (CHALLENGE §9 step 6, "fails → feed back, rewrite (max 2)"). The
  line holds the message instead. This is the removed experiment the rubric asks for;
  see §3.
- **Sender account age / prior message count.** Needs new fields in `fixtures/cases.json`
  and a parser change, and moves no case in the set.
- **New evaluation cases**, including the payment-redirection case the vision names as
  the most dangerous. 28 is pinned in the parity check, in two tables and in the README;
  a 29th case costs a recording pass and every published number. Write it into the
  README's `## Main failure mode` as the gap it is.
- **A third contract for untrusted input.** It is real in the code — `message.ts`,
  `llm.ts`, `authority.ts` — and unanchored, and a new contract is the user's call
  ([`CLAUDE.md`](../CLAUDE.md)). If it is wanted, it is a 20-minute job **after** the
  numbers land, not before.
- **`src/service/`.** It exits 1 saying nothing is listening, which is honest and which
  the SUBMISSION check accepts. CHALLENGE §12 claims the approval gate is "surfaced by
  `src/service/`" — either that line is corrected in step 5, or the service is built,
  and it is only built if step 6 finishes before 19:00. The video can show the gate from
  `yarn sim overload --replay --log` and the trajectory files instead.
- **A `channel` field, a deterministic thread summary, an audit trajectory, development
  session summaries.** All four are README paragraphs at most, and only if the prose
  step finishes early.
