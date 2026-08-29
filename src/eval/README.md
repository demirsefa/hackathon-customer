# src/eval/

Runs the 28 evaluation cases against `src/core/` directly and prints the results
table. No HTTP, no queue timing, no scenario playback — one message in, one
decision out, scored against ground truth.

```bash
yarn eval              # replays fixtures/llm-cache.json, no API key needed
yarn eval --live       # real API calls, requires a key, records what they answered
```

The default run must be deterministic and reproducible on a clean machine
without credentials.

## The files

```text
index.ts       the entry point, and the only file here that touches a disk.
run.ts         every line over the same case list, keeping what each one did.
score.ts       decisions in, numbers out. Pure.
report.ts      a scorecard as terminal lines. Pure.
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
