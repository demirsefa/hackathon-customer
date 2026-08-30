# src/sim/

Timestamped scenario player. Feeds a scenario's messages through `src/core/` in
arrival order, advances a simulated clock, and models the operator working the
queue top-down.

This is where the primary metric is produced: how many of the messages that
truly needed attention were actually reached before capacity ran out.

**The player itself is not written yet.** Until it is, the command resolves its
scenario and its mode, says that no coverage number was produced, and exits `1`. It
does not exit `0`: a placeholder that reports success is the one output a reader takes
for a run that worked, and the number this whole submission rests on would be the
thing it was lying about.

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

## The scenario is required, and can be picked

```bash
yarn sim
```

Typed at a terminal with no scenario, this offers the two above and then the two
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
