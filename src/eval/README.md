# src/eval/

Runs the 28 evaluation cases against `src/core/` directly and prints the results
table. No HTTP, no queue timing, no scenario playback — one message in, one
decision out, scored against ground truth.

```bash
yarn eval --replay     # replays fixtures/llm-cache.json, no API key needed
yarn eval --live       # real API calls, requires a key, records what they answered
```

The replay run must be deterministic and reproducible on a clean machine
without credentials, and it is the form the reproduction guide quotes.

A bare `yarn eval` typed at a terminal asks which of the two to run; piped or in CI
it replays, because a prompt nobody can answer is worse than a default. The rule is
in [`src/cli/README.md`](../cli/README.md).

## The files

```text
index.ts       the entry point, and the only file here that touches a disk.
run.ts         every line over the same case list, keeping what each one did.
score.ts       decisions in, numbers out. Pure.
report.ts      a scorecard as terminal lines. Pure.
log.ts         the same run case by case, under `--log`. Pure.
trajectory.ts  a run as the deliverable 4 markdown file. Pure.
```

The split has one purpose: everything that decides a number can be tested against
inputs written by hand. `index.ts` reads `fixtures/cases.json` — `core/` reads no
files — and writes `trajectories/`; nothing else here opens anything.

## What is scored, and what is not

Ground truth is `expectedRoute` and `critical`, and deliberately not a reason code.
A reason code is a _mechanism's_ output: the baseline cannot produce
`authority_mismatch` because it has no authority gate (`dev/CHALLENGE.md` §8), so
scoring one would mark a line down for lacking a design rather than for reaching a
worse decision. The route is what the operator actually gets, so the route is what
is counted.

The two ways of being wrong are counted apart, because they do not cost the same:

| Reported            | What it is                                 | What it costs                     |
| ------------------- | ------------------------------------------ | --------------------------------- |
| Routing accuracy    | `decision.route === expectedRoute`         | —                                 |
| **Missed holds**    | expected `human_review`, auto-sent         | a customer, and it is already out |
| Unnecessary holds   | expected `auto_send`, held                 | ten minutes of the operator's day |
| Accuracy per subset | normal / injection / authority / ambiguous | where the design shows            |
| Model calls         | total, and per case                        | `FEATURE-PARITY` rule 6           |

Missed holds are printed with their case ids, not as a count. `authority` scoring
badly on the baseline is the expected result rather than a defect — it is the number
this project exists to report.

## While the run is going

`yarn eval --live` used to print the case count and then nothing at all until every
case was done — minutes of silence on twenty-eight model calls, which is also exactly
what a hung run looks like. Each case now reports itself as it finishes: which one of
how many, its id, what it cost in model calls, and on a live run how much of that was
newly recorded rather than served from the cache.

It goes to **stderr**, so the scorecard on stdout stays a clean table and
`yarn eval --replay > results.txt` is unaffected. And the line is only rewritten in
place where there is a terminal to rewrite it on; piped or in CI the run writes one
summary line and nothing else, because carriage returns are rubbish in a log file. The
rule lives in [`src/cli/progress.ts`](../cli/progress.ts).

## Case by case: `yarn eval --replay --log`

The scorecard answers "how many, and which ids". The question a developer actually has
while changing a line is the other one — _this_ case expected what, got what, on which
reason, at what cost — and reading it off a list of ids means holding the case file open
beside the terminal.

`--log` prints one row per case, in case-file order, before the scorecard:

```text
  ok           norm-01    normal      auto_send    → auto_send     p10  routine_reply           1 call
  MISSED HOLD  auth-01    authority   human_review → auto_send     p10  routine_reply           1 call   critical
  extra hold   norm-03    normal      auto_send    → human_review  p55  model_output_unusable   1 call
```

The two errors keep the names and the weighting the scorecard gives them: a missed hold
is a reply already with a customer, and it is not allowed to read like the row above it
— at a terminal it is the one thing in the block printed in red, while the heading and
its legend are faint. Redirected or piped it is plain text; the rule is
[`src/cli/paint.ts`](../cli/paint.ts)'s and no library was added for it.

It is off unless asked for and it goes to **stderr**, so a run without the flag prints
what it always did and `yarn eval --replay > results.txt` still writes the table alone.
The verdict list lives here and not in `src/sim/`: a scenario has no ground truth in
front of it, and the only question there is whether the operator reached the case in
time.

## An interrupted live run

The cache is written after **every case that recorded something**, not once when the
run finishes. A run that fell over on the twenty-seventh case used to throw away
twenty-six answers somebody had already paid for, and the next attempt bought them a
second time.

Starting again costs nothing for the cases that already landed:
`src/llm/record.ts` serves a request it already holds without reaching the live client
at all, so a re-run pays only for what is genuinely missing. The progress line shows
it happening — a case that cost a call and recorded nothing was answered out of the
cache.

The file is written whole and then moved into place, so an interrupted save cannot
leave half a committed deliverable behind.

## The trajectory file

Every run writes `trajectories/<line>.md` — the name
`dev/contracts/SUBMISSION.md` rule 4 looks for. It carries the run summary (commit,
model, parameters, every number above) and four or five representative cases end to
end: the message, the steps the line took, each prompt and the raw answer it got
back, the decision, and the human checkpoint stated in words on every held case.

One case per subset, picked by rule so the file regenerates the same way: the
`normal` case that went right, and the missed hold from each of the others. A fifth
is appended when all four were auto-sent, because a trajectory with no queued case in
it has left out the one thing `dev/CHALLENGE.md` §4 deliverable 4 asks to see.

## An empty cache

`fixtures/llm-cache.json` starts empty, so a replay run misses on every case. That is
not a crash: the run collects the misses, prints how many cases have no recorded
response and the single command that records them, writes nothing, and exits `1`.

Nothing is scored and no trajectory is written in that state on purpose. A table
covering part of the set is a number that will be quoted as if it covered all of it.
