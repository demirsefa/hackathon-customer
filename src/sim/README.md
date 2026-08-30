# src/sim/

Timestamped scenario player. Feeds a scenario's messages through `src/core/` in
arrival order, advances a simulated clock, and models the operator working the
queue top-down.

**This is where the primary metric is produced:**

> **Critical case coverage** — of the arrivals ground truth marks `critical`, the share
> the operator actually **opened** within four **working** hours of their arrival.

Opened, not answered. The question `dev/CHALLENGE.md` §10 asks is whether the message
she genuinely needed to see reached her in time, so a case a line answered automatically
counts as missed however good the reply was. That is not a technicality — it is the
whole claim this project makes.

```bash
yarn sim overload --replay
```

```bash
yarn sim overload --live
```

Two modes, the same pair `yarn eval` carries. `--replay` reads
`fixtures/llm-cache.json` and needs no credentials; `--live` calls the model and
records what it answered. The primary metric comes out of this program, so a judge
has to be able to reproduce it without a key — that is why the free run is the one
the reproduction guide quotes.

A named scenario with no mode flag replays, exactly as it always has. `--replay` only
lets the command say so, which is what makes it quotable.

## The files

```text
index.ts       the entry point, and the only file here that touches a disk.
play.ts        the line over the arrivals, then the operator over the queue.
score.ts       a timeline in, the coverage numbers out. Pure.
report.ts      the metric as terminal lines, and the two clock formats. Pure.
log.ts         her day, opening by opening. Pure.
record.ts      the run as the deliverable 4 JSON file — the raw one. Pure.
trajectory.ts  the same run as the markdown beside it, rendered. Pure.
```

`record.ts` mirrors `src/eval/record.ts`, and the reason it is a module of its own is
given there. It matters more here: the markdown shows the first twenty-four openings of
ninety arrivals, so the JSON is the only place the rest of the run exists.

The split mirrors `src/eval/` on purpose, and for the same reason: everything that
decides a number can be checked against inputs written by hand. `index.ts` reads
`scenarios/<name>.json` and `fixtures/cases.json` — `core/` reads no files — and writes
`trajectories/`; nothing else here opens anything.

`play.ts` is itself two halves. `playScenario` hands each arrival to a line, one at a
time; `walkQueue` is pure, synchronous, knows nothing about a model, and is where the
metric is actually produced. That second half is what the checks in
`src/__test__/unit/sim-play.test.ts` drive, with no scenario file and no network in the
way. The tests carry a `sim-` prefix because `src/eval/` already owns `score.test.ts`
and `report.test.ts`, and every test in this project lives in one folder.

## Watching her work

The report says how the ordering did. The block above it says what she did — every case she
opened, in her order, out of a queue whose depth is printed beside it, with the hours
the shift and the weekend took out of the middle:

```text
  Mon 07 Sept 11:50   q 3  M-0027 · norm-04      p40  sensitive_category      waited  170 min  in window
        ⋯ 1h off the clock
  Mon 07 Sept 13:00   q 3  M-0078 · amb-02       p55  model_output_unusable   waited    0 min  in window  critical
```

Three lines close it: how many arrivals were answered automatically and never reached
her at all, what was still queued at the horizon, and how many interim messages went
out. Those three are the coverage number said in words rather than as a percentage.

It **scores nothing**. Whether a decision matched ground truth is `src/eval/`'s
question and is answered there; a scenario replays one case ninety times
over a clock, and a right-or-wrong verdict beside a coverage number would answer a
question this run never asked.

At a terminal the scaffolding — the heading, the gaps, the three closing lines — is
faint and `LATE` is red, so the rows themselves are what is left at full strength.
Redirected or piped it is plain text: the rule and the two effects are
[`src/cli/paint.ts`](../cli/paint.ts)'s, and no library was added for them.

Written to **stderr** beside the progress line, so the metric block on stdout is
untouched and `yarn sim overload --replay > out` writes the file it always did.

## Determinism is not negotiable

This program produces the published number, so:

- **No clock is read.** Not in `core/`, not in `sim/`, not even for a progress line —
  which is why the summary this command prints says what it played and not how long it
  took. Every instant comes from the scenario or from `core/operator.ts` arithmetic
  over it.
- **No randomness.** The arrivals are listed in the file, absolutely timed. The
  generator that wrote them (`scripts/make-scenario.mjs`) is seeded and is not part of
  the measured path.
- **Messages one at a time**, in arrival order. No `Promise.all` — `dev/CHALLENGE.md`
  §10 requires it, because a model handed a batch finds a contradiction by comparison.
- **Whole minutes** throughout.
- The queue's order is **total**: priority descending, then arrival, then message id.
  The third key is not decoration. One scenario replays the same case many times and
  every copy carries the same score, so leaning on `Array#sort` stability would settle
  a real tie by input order — an order no scenario file states.

`src/__test__/unit/sim-determinism.test.ts` plays both committed scenarios twice in one
process and asserts every rendering of the two runs is identical.

## Where the run stops

Four working hours after the **last** arrival. Past that instant nothing still in the
queue can be reached inside its window, so playing on would move no number the metric
reports — and "still queued" needs an instant it is counted at, or it means whatever
the loop happened to feel like. The trajectory prints it.

## The interim message, and why it is on a wall clock

`dev/CHALLENGE.md` §7 feature 6: a queued case that has passed the threshold and that
the operator has not looked at gets an interim message. This is where the declared
feature becomes real — `core/policy.ts`'s `needsInterim` is called from here.

The threshold is measured in **wall-clock** minutes while everything else here is
measured in working ones, and the one sentence for it is this: a customer waiting on a
Saturday does not know that the desk is closed. Working minutes measure the operator;
this number measures the silence the sender actually experiences.

It changes nothing. The case stays in the queue, it still requires approval, and the
answer is still hers to send. Because it moves nothing, it is derived from the finished
timeline rather than interleaved into the walk, which keeps the walk a function of the
ordering alone.

## What the baseline's number actually says

Worth stating plainly, because the figure is easy to misread. Under `overload` the
baseline holds 22 of 90 arrivals; her capacity is 42 cases a day. **Her queue never
outruns her day**, she opens everything in it, and the coverage figure is still low —
because the arrivals it auto-sent include most of the critical ones, and no ordering
reaches a message she never saw.

So this run reports a _holding_ failure, not a capacity one. The ordering machinery
above is what the advanced line will be measured on, when its queue is the one that is
longer than the day.

## The scenario is required, and can be picked

```bash
yarn sim
```

Typed at a terminal with no scenario, this offers the two scenarios and then the two
modes, instead of printing a usage line and stopping. Piped or in CI it still prints
the usage line and exits 1, because an unattended run must fail rather than wait for
an answer — a missing scenario is the one thing here no default can invent.

A scenario that is _named_ but does not exist stops the same way. `yarn sim overlaod`
used to print `scenario: overlaod` and exit 0, which reads as a run that happened.

The menu lives in [`src/cli/ask.ts`](../cli/ask.ts) rather than here: it is a question
about the terminal, not about playing a scenario, and it is governed by one rule —
a command that states its mode is never asked anything, so both commands above behave
exactly as the reproduction guide says. That rule and why the file sits where it does
are written down in [`src/cli/README.md`](../cli/README.md).

## A replay miss stops the run

`src/eval/` collects misses and reports how many, because an empty cache is a state a
judge legitimately starts from. Here it is fatal on the first one: by the time a
scenario plays, the cache is a committed deliverable covering every case, so a miss
means this run and the recorded one are not the same run. Nothing is printed and no
trajectory is written in that state — a partial coverage figure would be quoted as if
it covered the scenario.
