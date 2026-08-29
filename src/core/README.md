# src/core/

Pure functions. No I/O, no clock, no network, no process state.

Everything that decides _what happens to a message_ lives here. The clock and the
LLM client are passed in as arguments, never imported, so the same code runs
identically under `src/eval/`, `src/sim/` and `src/service/`.

```text
decision.ts    the vocabulary: routes, reason codes, priority, the approval gate.
message.ts     the envelope, and the order references pulled out of untrusted text.
records.ts     the record layer — the only source of ownership and identity.
authority.ts   the gate over that layer. Waiting for the advanced line.
policy.ts      the law both lines are written against.
cases.ts       the evaluation set parsed and validated. The file read stays outside.
llm.ts         the client interface and the primitives a response is parsed with.
pipeline.ts    what a line is, REQUIRED_FEATURES, and which lines exist.
baseline/      one model call, then the risky-category check. CHALLENGE §8.
advanced/      a placeholder plus its prompts. CHALLENGE §9.
```

## The two lines

`REQUIRED_FEATURES` lists **features** — the seven capabilities of `dev/CHALLENGE.md`
§7, what the operator gets. It does not list **mechanisms**. The authority gate, the
draft policy check and the confidence threshold are ways of reaching a feature, and
requiring them of every line would make the lines identical by contract.

Every line is handed the same `PipelineInput`, record layer included. The baseline
never opens it: it decides from the model's answer about the text alone. That is not
an omission to fix — it is the design of `dev/CHALLENGE.md` §8, and the distance
between deciding from the text and deciding from the record is the number this whole
project reports. `src/__test__/unit/baseline.test.ts` hands it a record store that
throws on any read, so the claim is checked rather than described.

The advanced line is not written yet. Until it is, `PIPELINES` holds the baseline
alone and part of `dev/contracts/FEATURE-PARITY.md` is suspended — see that file's
Enforcement section for exactly which assertions, and when they return.
