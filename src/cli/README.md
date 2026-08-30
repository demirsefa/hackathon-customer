# src/cli/

What the three entry points — `src/eval/`, `src/sim/`, `src/service/` — share about
talking to a terminal. Nothing here decides anything about a support message; it is
the shell around the programs that do.

Three things live here, and they are here because they belong to every entry point and
to none of the areas under them:

| File          | What it owns                                                                  |
| ------------- | ----------------------------------------------------------------------------- |
| `env.ts`      | Loading `.env`, and the one line worth printing when it is not there.         |
| `ask.ts`      | The menus, and the pure rule that decides whether a command may ask anything. |
| `progress.ts` | The line that says a run is still moving, and where it may be written.        |

`env.ts` does not belong in `src/llm/` even though the only thing the file carries is
an API key: `src/llm/` takes the key as an argument and reads no environment at all,
which is what keeps "exactly one place per program where a credential enters" true.
Loading the file is an entry-point concern, so it sits with the entry points.

`progress.ts` is here rather than in `src/eval/` for the same reason both of the others
are. Deciding whether a line may be rewritten in place is a question about the
destination — is it a terminal, or a log file somebody will read later — and it has
nothing to do with scoring a case. `src/sim/` will want the same answer the moment the
scenario player runs long enough to be worth watching, and a copy of the rule in two
folders is how the two stop agreeing.

`ask.ts` does not belong in `src/sim/` even though `yarn sim` was its only caller
first: it is the same question about the terminal that `env.ts` answers, and putting
it beside the scenario player would make the player's folder own a concern that has
nothing to do with playing a scenario. `yarn eval` now asks the mode question too,
out of the same file — the rule below is one rule because it is written once.

## The rule both files follow

**A documented command never behaves differently because of anything in here, and
the documented command is the one that says what it wants.**

| Typed                                       | What happens                                           |
| ------------------------------------------- | ------------------------------------------------------ |
| `--replay` or `--live`                      | that mode, no question, terminal or not                |
| both flags                                  | one line naming the conflict, then usage, exit 1       |
| bare, at a terminal                         | the menu — scenario if missing, then the mode          |
| bare, piped or in CI                        | replay: the free run, and never a hanging prompt       |
| `yarn sim` with no scenario, piped or in CI | `SIM_USAGE`, exit 1 — the one argument nothing invents |
| `--help` or `-h`                            | the usage line on stdout, exit 0                       |
| anything else on the line                   | one line naming it, then usage, exit 1                 |

## The other half: a word this program does not understand

`checkArguments` is the last row of that table, and it exists because the row used to
read "silently ignored". `--lve` is not `--live`, so it fell through to the bare form
and the run replayed — the safe run, but not the one that was typed, and nothing said
so. `yarn sim overlaod --replay` was worse: no such scenario exists, and the command
printed `scenario: overlaod` and exited 0, which is the one output a reader takes for
success.

So every word on the command line is now either a flag this program takes, the one
positional argument it accepts, or a usage mistake that ends on the usage line. What
each command accepts is held as data — `EVAL_COMMAND`, `SIM_COMMAND` — rather than as
two branches, so the rule stays single and both commands complain in the same shape.
`--` is dropped rather than reported: `yarn eval -- --replay` is a form people type out
of npm habit, and yarn passes the separator straight through.

`yarn eval --replay`, `yarn eval --live`, `yarn sim overload --replay` and
`yarn sim overload --live` are what the reproduction guide quotes, and a judge who
pastes one gets the run, not a question. Every menu here is a stand-in for something
nobody said, and nothing said out loud is ever overridden by one.

**What changed, and why.** The rule used to name the _bare_ commands — `yarn eval`
and `yarn sim overload` — as the documented ones, which meant the bare command had to
be silent and the menu could only ever cover `yarn sim`'s missing scenario. The cost
landed on the person running this repository every day: with replay the silent
default, reaching a live run means editing an IDE run configuration to pass a flag,
and the two runs that hit an empty cache were both a bare command doing the safe
thing quietly. So the flagged form became the documented form. A bare command now
asks about the mode instead of assuming one, and what it costs — one question — is
paid only by somebody sitting at a terminal who can answer it. Nothing unattended
changed: piped, in CI, or in an editor that gives no TTY, `yarn eval` still replays
exactly as before, because a prompt no one can answer is worse than a wrong default.
