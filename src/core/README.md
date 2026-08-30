# src/core/

Pure functions. No I/O, no clock, no network, no process state.

Everything that decides _what happens to a message_ lives here. The clock and the
LLM client are passed in as arguments, never imported, so the same code runs
identically under `src/eval/` and `src/sim/`.

```text
decision.ts    the vocabulary: routes, reason codes, priority, the approval gate.
message.ts     the instant rule, and the order references pulled out of untrusted text.
records.ts     the store over the record layer — the only source of ownership and identity.
authority.ts   the gate over that layer, and the verdict no later stage may lift.
policy.ts      the law both lines are written against.
operator.ts    arithmetic over the operator's calendar: her shift, her breaks, her minutes.
cases.ts       the evaluation set parsed and validated. The file read stays outside.
scenario.ts    a scenario parsed the same way, and joined to the cases it names.
queue.ts       the read-first order of the operator's queue, and why it is total.
llm.ts         the primitives a prompt is built with and a response is parsed with.
pipeline.ts    what a line is, and which lines exist.
baseline/      one model call, then the risky-category check. CHALLENGE §8.
advanced/      record gate, classification, gate, draft, policy check. CHALLENGE §9.
```

`cases.ts`, `scenario.ts` and `operator.ts` validate through `../utils/parse.ts` — the
shape checks all three used to keep a copy of. It is pure, so importing it costs this
folder none of the promise above; `src/utils/README.md` says why it is its own area.

The shapes those files decide over are declared in `../types/` — `InboundMessage`,
`RecordStore`, `OperatorConfig`, `Scenario`, `LlmClient`. Every export there is erased
before anything runs, so importing it costs this folder none of the promise above
either; `src/types/README.md` says why it is its own area, and which shapes stay here
regardless.

## What the metric needs from here

Three of the files above exist for the primary metric rather than for a decision, and
they are here for one reason: they are pure, and both lines are measured through them.

- `operator.ts` is her calendar. `workingMinutesBetween` answers "how long did this wait"
  and `advanceWorkingMinutes` answers "where do her ten minutes land" — the pair a
  scenario is played on.
- `queue.ts` is the order she works in. It is **total** down to the message id, because
  a scenario replays one case many times and every copy carries the same priority;
  leaning on `Array#sort` stability would settle a real tie by input order, which is not
  something a scenario file states.
- `policy.ts` holds the thresholds, `CRITICAL_COVERAGE_MINUTES` among them. Changing the
  window the metric is measured over is one edit in one file, on purpose.

`scenario.ts` sits beside `cases.ts` and follows it exactly: decoded JSON in, a
validated value out, and the `readFile` left to the entry point that owns a disk.
Playing the scenario is `src/sim/`'s job; saying what a scenario _is_ belongs here,
where every other definition already lives.

## The two lines

A **feature** is one of the capabilities of `dev/CHALLENGE.md` §7 — what the operator
gets. A **mechanism** is not: the authority gate, the draft policy check and the
confidence threshold are ways of reaching a feature, and requiring them of every line
would make the lines identical by contract.

A line does not carry a list of what it can do. It used to, and the check that compared
two such lists passed whatever both lines wrote in them — see rule 1 of
`dev/contracts/FEATURE-PARITY.md`. Each capability is now read off the decisions a line
produces, in `src/__test__/contract/parity.contract.test.ts`.

Every line is handed the same `PipelineInput`, record layer included. The baseline
never opens it: it decides from the model's answer about the text alone. That is not
an omission to fix — it is the design of `dev/CHALLENGE.md` §8, and the distance
between deciding from the text and deciding from the record is the number this whole
project reports. `src/__test__/unit/baseline.test.ts` hands it a record store that
throws on any read, so the claim is checked rather than described.

The advanced line is not written yet. Until it is, `PIPELINES` holds the baseline
alone and part of `dev/contracts/FEATURE-PARITY.md` is suspended — see that file's
Enforcement section for exactly which assertions, and when they return.
