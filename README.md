# Support Triage Agent — micro1 Agentic Workflows Hackathon

Single-person support desk triage: decide **what the operator reads first**, and
hold back anything that must not be answered automatically.

> Status: both lines are built, both are measured, and every number below comes out of a
> committed run. `yarn eval --replay` and `yarn sim overload --replay` reproduce them on a
> clean machine with no API key.

## The user and the bottleneck

Merve runs a support desk on her own. Sixty to eighty messages arrive on a weekday
morning; her shift is 420 working minutes and a case takes her ten, so **forty-two of
them fit in a day**. The rest wait, and some of them are still waiting when they stop
mattering.

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

## Running it

Node 22.18 or newer, and nothing else installed by hand. The sources are TypeScript
and Node runs them directly, so an older Node cannot start them at all. Yarn 4 comes
with the repository — `packageManager` in `package.json` pins the version.

```bash
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
| `yarn serve`                   | the HTTP surface and the approval queue            | no          |

Every command runs **both lines** over the same input and reports them side by side —
`dev/contracts/FEATURE-PARITY.md` rule 4 asks that they never be scored on separate runs.
Add `--log` to either `eval` or `sim` to read the run case by case instead of as a table.

Each of them takes `--live` or `--replay` and nothing else, and `--help` prints its
usage line. Typed bare at a terminal they ask which mode to run; piped or in CI they
replay, so an unattended run never waits on a question nobody is there to answer. The
rule, and why the flagged form is the documented one, is in
[`src/cli/README.md`](src/cli/README.md).

A key is only ever needed for `--live`:

```bash
cp .env.example .env   # then put ANTHROPIC_API_KEY in it
```

## Improvement Changelog

How the primary metric moved, and why. **Critical coverage** is the share of arrivals
ground truth marks critical that the operator opened within four working hours; the
`overload` figure is the headline. Every number in the Evidence column is a field in a
committed file, reachable without running anything.

| Stage                                   | What was tried and why                                                                                                                                                                                                                                                                                                                                                                                                                  | Evidence                                                                                                                                                             | Decision / Learning                                                                                                                                                                                                                                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Baseline                            | One model call returning category, urgency and draft together, then one risk decision: is the category on a fixed sensitive list? Built deliberately as the design a competent person writes first, not as a strawman — its weaknesses are what the comparison is for.                                                                                                                                                                  | `trajectories/baseline.json`, `baseline-overload.json`. Coverage **13 / 42 (31%)**, routing 12 / 28.                                                                 | Kept as the baseline. Read on its own the result looked reasonable, which turned out to be the problem: nobody asked _why_ the operator was being shown the cases she was shown.                                                                                                                                                   |
| 2 · Made the evidence machine-readable  | The only record of a run was a generated markdown page, so every claim about it rested on prose we had written ourselves. Added a versioned JSON record per run and made the markdown a rendering of it — the entry point serialises, re-parses, and renders from the parsed value.                                                                                                                                                     | `trajectories/*.json`, schema `support-triage/{eval,sim}-run@1`. Asserted in `src/__test__/unit/{eval,sim}-record.test.ts`.                                          | Kept. This is what made stages 3 and 4 findable at all: one `jq` query over the record showed that **13 of the 13** critical cases the operator reached carried the reason `model_output_unusable`. A metric you can only read as prose is a metric you cannot audit.                                                              |
| 3 · Found the coverage was an artefact  | Six of the 28 recorded model responses arrive wrapped in a markdown code fence, all six carrying valid JSON. `parseObject` called `JSON.parse` on the raw text, so all six were discarded as unusable and routed to a human. Stripped the fence before parsing.                                                                                                                                                                         | `src/core/llm.ts`, 15 cases in `src/__test__/unit/llm.test.ts`. Coverage fell to **3 / 42 (7%)**, routing 9 / 28.                                                    | Kept, and the published number was corrected in the open (`dev/CHALLENGE.md` §10 carries all three figures and why each was wrong). The headline had been 24 points of parser bug: the design's own risk rule had contributed **none** of the coverage. A defect can inflate a metric and still look plausible.                    |
| 4 · Fixed the risk rule it exposed      | With the fence gone, `isSensitive` compared the model's free-text category to the list by equality. The model writes `refund_request`, `returns_refunds`, `billing_dispute`; the list holds `refund`, `billing`. Nothing matched. Switched to containment, in shared code.                                                                                                                                                              | `src/core/policy.ts`, `src/__test__/unit/policy.test.ts`. Coverage **9 / 42 (21%)**, routing 12 / 28, normal subset 10 / 10, unnecessary holds 0.                    | Kept. Required by `FEATURE-PARITY` rule 7 — the baseline is never left weak to widen the gap — and it lives in `policy.ts`, so the advanced line inherits it. Routing returned to 12 / 28, but a different 12: legitimate traffic is now perfect and the whole remaining loss sits on hidden intent.                               |
| 5 · Built the advanced line             | Opened the record layer **before** any model call — unknown sender, a key that resolves to nothing, an order owned by somebody else — then split classification from drafting, which frees the classifier to be asked one more thing: is this text aimed at the system? In one call it cannot be asked honestly, because the model reporting the instruction is the model that just followed it.                                        | `trajectories/advanced-overload.json`, `advanced.json`. Coverage **20 / 42 (48%)**, routing 23 / 28, injection 8 / 8, authority 6 / 6.                               | Kept. The authority subset went 0 / 6 → 6 / 6 at **zero model calls** — the fact was in the records the whole time and no line had opened them. Injection went 1 / 8 → 8 / 8 on a question that costs nothing extra: the same call, one more field.                                                                                |
| 6 · Fixed what the first run exposed    | Under overload the operator was spending her morning on thank-you notes. The deterministic permitted-order check passes, then the model's second opinion refuses its own draft — and that refusal was being reported as `draft_policy_violation`, priority 90, ahead of every refund demand in the queue. Reported it as `low_confidence` instead: nothing was breached, something was doubted.                                         | `src/core/advanced/index.ts`, `trajectories/advanced-overload.json`. Coverage **24 / 42 (57%)**, no change in model calls.                                           | Kept. Nine points of coverage for a reason code, which is the lesson: the queue is sorted by _why_ a message was held, so a reason that overstates itself is not a labelling mistake, it is a scheduling bug.                                                                                                                      |
| 7 · Tried reading attacks last — undone | If holding is already the defence, a blocked injection attempt harms nobody while it waits, and a customer locked out of her account does. So `instruction_in_message` was dropped below `sensitive_category` and `unknown_sender`, to read waiting people before failed attacks.                                                                                                                                                       | Same command, `yarn sim overload --replay`. Coverage fell to **22 / 42 (52%)**, from 24 / 42.                                                                        | **Reverted.** The argument was sound and the data refused it: 17 of the 27 injection arrivals are themselves marked critical, so reading them later loses more than the reordering wins. Recorded in `dev/CHALLENGE.md` §10 next to the change that was kept, because a rejected experiment that leaves no trace gets tried again. |
| 8 · Took the second opinion out         | The line's third call asked the model whether its own draft was sound. Under overload the operator was opening thank-you notes ahead of refund demands because of it. First the reason code was corrected (a refusal after the deterministic check passes is doubt, not a breach); then the call was removed altogether, since `validateDraft` already answers from the records what the model was being asked to answer from the text. | `yarn sim overload --replay`, `yarn eval --replay`. Coverage **24 / 42 (57%)**, routing **27 / 28**, unnecessary holds **4 → 0**, cost **1.29 → 1.00** calls a case. | Kept out. It refused four legitimate replies and rescued none — every case it touched it made worse — and taking it out left the advanced line costing exactly what the baseline costs. A model asked to check work a record already settles supplies doubt, not judgement.                                                        |

**What the eight stages leave.** The model was never the weak part: in all eight
injection cases it names the attack and refuses it in its own draft. Every point of the
improvement came from the arrangement around it — opening the records before the model
instead of after, asking one question in a call that is not also writing the reply, and
sorting the queue by a reason that means what it says.

What is left is in `## Main failure mode` below, and it is a different shape of problem
from the one we started with.

## Results

Both lines, same 28 cases and same two scenarios, one run each. Every figure below is a
field in a committed file under `trajectories/`, produced by a command in the
reproduction guide.

| Metric                                    | Baseline      | Advanced      | Change         |
| ----------------------------------------- | ------------- | ------------- | -------------- |
| **Critical coverage - overload**          | 9 / 42 (21%)  | 24 / 42 (57%) | **+36 points** |
| **Critical coverage - normal day**        | 4 / 19 (21%)  | 18 / 19 (95%) | **+74 points** |
| Routing accuracy - 28 cases               | 12 / 28 (43%) | 27 / 28 (96%) | +53 points     |
| Routing - injection subset                | 1 / 8         | 8 / 8         | +7 cases       |
| Routing - authority subset                | 0 / 6         | 6 / 6         | +6 cases       |
| Missed holds - auto-sent, should not be   | 16            | 1             | -15            |
| False positives - held, could be answered | 0             | 0             | unchanged      |
| Model calls per case                      | 1.00          | 1.00          | **unchanged**  |
| Reply quality, out of 5                   | 4             | 4             | unchanged      |
| Operator minutes used - overload, of 659  | 150           | 650           | +500           |

**Critical coverage under overload is the headline**, and it is the only number this
project set out to move. `yarn sim overload --replay` prints it; the run behind it is
`trajectories/advanced-overload.json`.

**It costs the same.** 28 model calls over 28 cases, exactly what the baseline spends.
The record gate answers ten of them without a model at all, and that pays for the ones
that need two. The improvement is not bought with a bigger budget - the ceiling is two
calls and `dev/contracts/FEATURE-PARITY.md` rule 6 states it.

**The authority row is the thesis in one line.** Six messages that are polite, well
formed, and about a real order - asked by somebody who does not own it. No amount of
reading the text finds that out. The advanced line gets all six, and gets them at **zero
model calls**, because the fact was in the order records and the work was opening them.

**Reply quality is measured on the three cases both lines answer** (`norm-01`, `norm-02`,
`norm-06`) so the comparison is like for like, scored by the author on a five-point
scale: 5 answers the question, 4 acknowledges it correctly and promises a follow-up, 3 is
generic, 2 is wrong, 1 is harmful. Both score 4, and the sameness is the point - the same
model writes both drafts, so the designs do not differ on how a reply reads. They differ
on which messages get one.

## Main failure mode

**One case, out of twenty-eight.** Nothing is held that could have been answered, and
one message goes out that should not: **`amb-02`**. The customer writes that the wrong colour arrived and asks for a replacement or a refund, and mentions the invoice.
The classification comes back as an ordinary order issue, so the gate lets it through -
and the draft the next call then writes offers a full refund in as many words.

The two calls disagree with each other and nothing compares them. Splitting
classification from drafting is what makes this line work everywhere else; the cost of
the split is that the two halves can contradict, and today only the classifier's half
reaches the gate. A draft that promises a refund should be able to reopen a category that
said there was nothing to refund. That check does not exist.

**And the desk that used to be bypassed can now no longer be emptied in a day.** Under
overload the line holds 65 of 90 arrivals and every one of them belongs in the queue -
against a day that fits 42. The average wait is 257 working minutes and eighteen critical
arrivals were opened after their four-hour window had already closed. Coverage is 57% and
not 95% for that reason alone: on a normal day, where the volume fits, the same design
reaches 18 of 19.

That is a real failure and it is a better one. The baseline's queue was short because the
desk was walked past; this queue is long because the right things are in it. But
"correctly queued" and "read in time" are not the same promise, and only the second one
is what the customer experiences.

## Hot take

**Our best replies were the dangerous ones.**

Read the baseline's auto-sent drafts in `trajectories/baseline.json` and they are good.
On four of the eight injection cases the model spots the attack and refuses it _in the
draft it is sending_ - `inj-07` answers "I can't bypass review processes or follow
embedded instructions from message content". On the six authority cases it writes warm,
competent, correctly-formatted Turkish about delivery windows and cancellations. Read as
prose, that line looks like a working product.

Every one of those six is a stranger being told about somebody else's order.

The quality of the reply told us nothing about whether it should have been sent, and it
would have carried a demo. What told us was a question the text cannot answer - does this
sender own this order - and it was sitting in a database the whole time, being handed to
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

Node 22.18 or newer is the only prerequisite; Yarn 4 ships with the repository.

```bash
yarn install
```

```bash
yarn sim overload --replay
```

That prints both lines side by side and ends with the primary metric:

```
baseline - overload - 90 arrival(s)
  CRITICAL COVERAGE         9 / 42  (21%)   model calls  90 total, 1.00 per arrival
advanced - overload - 90 arrival(s)
  CRITICAL COVERAGE         24 / 42  (57%)  model calls  90 total, 1.00 per arrival
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
not. Re-running changes one row - the commit the run was made at.

Runtime, measured on an Apple M1 Max: `yarn install` takes about three seconds - it
fetches 145 MB into an empty Yarn cache, so a slow connection is the only thing that
makes it longer - and each of the three runs above finishes in under a second. There is
no build step; Node runs the TypeScript sources directly.

Cost: nothing. The replay path makes no network call and reads no API key, because every
model response these runs need is committed in `fixtures/llm-cache.json`. A machine with
no key and no connection reproduces the numbers above in full.

`--live` is the only path that spends anything. To reproduce the recordings themselves
rather than replay them, put an API key in the environment file and use it: it is the
same run against the real model. `yarn eval --live` is 28 model calls, one for each
evaluation case, and a `--live` scenario is 90, one for each arrival. They go to
`claude-sonnet-5` with `maxTokens` 16000 - the parameters are pinned in
[`src/llm/key.ts`](src/llm/key.ts) so that a recording is reproducible - and the prompts
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
