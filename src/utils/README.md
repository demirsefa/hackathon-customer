# src/utils/

Small, pure helpers that more than one area parses through, and that belong to none of
them.

## Why this is a sixth area

`fixtures/cases.json`, `scenarios/*.json` and the operator block inside a scenario are
three files with three schemas, and all three answered the same two questions — is this
an object, is this a non-empty string — in their own copy of the same eight lines. The
copies had already started to drift: one called the location a `path`, the next a
`label`, and a reader had to check which before trusting an error message.

It cannot live in `src/core/`. Core is where it is decided _what happens to a message_
(`src/core/README.md`), and a shape check decides nothing; it only refuses a file that
was written wrong. Nor can it live inside one of the three parsers, for the reason
`src/llm/README.md` gives about its own port: whichever of `cases.ts`, `scenario.ts` and
`operator.ts` owned the helpers would become a sideways dependency of the other two.
And it is not `cli/`, `eval/`, `sim/`, `service/` or `llm/`, because every one of those
is an I/O area and this reaches for nothing.

So it sits here, on its own, with the one promise that lets `core/` import it.

## The promise

**Pure.** No I/O, no clock, no network, no process state — the same promise
`src/core/README.md` makes, held to deliberately, because `core/` parses through this
module and an import that broke the promise would break it for `core/` too.

## The files

```text
parse.ts   the shape checks every committed file is parsed through, bound to a prefix.
```
