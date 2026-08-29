# src/cli/

What the three entry points — `src/eval/`, `src/sim/`, `src/service/` — share about
talking to a terminal. Nothing here decides anything about a support message; it is
the shell around the programs that do.

Two things live here, and they are here because they belong to every entry point and
to none of the areas under them:

| File     | What it owns                                                               |
| -------- | -------------------------------------------------------------------------- |
| `env.ts` | Loading `.env`, and the one warning worth printing when it is not there.   |
| `ask.ts` | The menu offered when a command is missing an argument a person must give. |

`env.ts` does not belong in `src/llm/` even though the only thing the file carries is
an API key: `src/llm/` takes the key as an argument and reads no environment at all,
which is what keeps "exactly one place per program where a credential enters" true.
Loading the file is an entry-point concern, so it sits with the entry points.

`ask.ts` does not belong in `src/sim/` even though `yarn sim` is its only caller
today: it is the same question about the terminal that `env.ts` answers, and putting
it beside the scenario player would make the player's folder own a concern that has
nothing to do with playing a scenario.

## The rule both files follow

**A documented command never behaves differently because of anything in here.**
`yarn eval`, `yarn eval --live`, `yarn sim overload` and `yarn sim overload --live`
are quoted verbatim in the reproduction guide, and a judge who pastes one gets the
run, not a question. The menu stands in for a missing argument and nothing else; a
piped or CI run does not get it either, and keeps the usage error it always had.
