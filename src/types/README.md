# src/types/

The project's domain vocabulary, in one place. Declarations only — no functions, no
values, nothing that survives compilation.

## Why this is a seventh area

The nouns this project is about — a message, an order, an operator's calendar, a
scenario — were each declared inside the module that also did something with them. A
reader who wanted to know what an `InboundMessage` _is_ had to open the file that
pulls order references out of one, and read past the regex to find out. The shapes are
what a newcomer needs first and they were the hardest thing to assemble a view of.

It cannot live in `src/core/`. Core is where it is decided _what happens to a message_
(`src/core/README.md`), and a declaration decides nothing. Nor is it `src/utils/`,
which is code that runs — small pure helpers with behaviour to test; there is nothing
here to call. And it is not `cli/`, `eval/`, `sim/` or `llm/`, because
every one of those is an I/O area and this reaches for nothing at all.

## The promise

**Type-only.** Every export here is erased by the time anything runs, so this area
carries no I/O by construction — it has no code in which to perform any. That is what
lets `src/core/` import from it without touching the purity promise in
`src/core/README.md`: an import of a type is not an import.

## The files

```text
message.ts    the inbound message, and the split between its envelope and its text.
records.ts    the record layer's shapes: orders, senders, and the store over them.
operator.ts   the operator's calendar, and why the zone is part of it.
scenario.ts   a scenario: when each message lands, and whose desk it lands on.
llm.ts        the model client, and what a call to one may carry.
```

## What is deliberately not here

A type read off a value stays with that value. `ReasonCode` is `REASON_CODES`,
`Feature` is `REQUIRED_FEATURES`, `CaseSubset` is `CASE_SUBSETS` — moving the type
would mean moving the array, and this area would stop being erasable. The types built
on those stay with them too, for the same reason: `Decision` carries a `ReasonCode`,
`Pipeline` carries a `Feature`, `EvaluationCase` and `ResolvedArrival` carry a
`CaseSubset`. Splitting any of them from its list would buy one file in this folder at
the price of an import cycle between the two.

Nor is a shape moved here just because it is a shape. `PipelineInput` is what
`Pipeline` is called with and has no other reader; it stays beside it, because
`dev/GUIDES.md` asks for units that move as a whole and a folder is not worth a file
holding half of one. The line is meaning, not mechanism: a noun several areas speak
about belongs here, and the argument list of one interface does not.
