# src/core/

Pure functions. No I/O, no clock, no network, no process state.

Everything that decides _what happens to a message_ lives here: risk signals,
ownership checks, classification, the hold/send gate, draft policy validation,
and the queue itself. The clock and the LLM client are passed in as arguments,
never imported, so the same code runs identically under `src/eval/`, `src/sim/` and
`src/service/`.

Both the baseline and the advanced pipeline are built from this folder. They
expose the same feature set; only the wiring differs.
