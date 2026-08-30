# trajectories/

Recorded agent runs kept as a deliverable: the instructions given, every step
taken, what each tool returned, retries, and the points where a human decision
was required.

Populated from real runs, not written by hand. `yarn eval --replay` rewrites this
folder every time it runs, from the committed model responses in `fixtures/`, so a
clean clone reproduces every number in these files exactly.

## Two files per run, and which one is the evidence

Every run leaves a pair, and they are not two accounts of the same thing:

| File            | What it is                                                                          |
| --------------- | ----------------------------------------------------------------------------------- |
| `<name>.json`   | **The run.** Machine-readable, complete, versioned by a `schema` field. Cite this.   |
| `<name>.md`     | A rendering of that JSON for a person to read. A slice, and generated, never edited. |

The direction matters. `src/eval/index.ts` and `src/sim/index.ts` build the record,
serialise it, **parse the serialised text back, and render the markdown from that** —
so a page can never state a fact its JSON does not carry. It is asserted, not assumed:
`src/__test__/unit/eval-record.test.ts` and `sim-record.test.ts` render from the object
and from its round trip and require the two to be identical.

So the markdown is a convenience. The `.json` is the artefact:

- `baseline.json` — all 28 cases, each with the prompt sent, the raw model answer, the
  record lookups and the decision, plus the scorecard. The markdown shows 4 of the 28.
- `baseline-overload.json`, `baseline-normal-day.json` — all 90 (and 45) arrivals, each
  with its decision, when the operator opened it and how long it waited, plus the
  coverage result and the operator model. The markdown shows the first 24 openings.

Every number quoted anywhere in this repository is a field in one of these files:

```bash
jq '.coverage | {critical, criticalReached, windowMinutes}' trajectories/baseline-overload.json
```

## The one row that moves on its own

**Commit** names the commit the run was produced at, and a file cannot name the commit
that will contain it — so regenerating after a later commit changes that row and
nothing else. A judge who runs the command and then looks at `git status` is seeing
that one line, not a different result. Nothing else in either file carries a clock:
there is no timestamp in the output, on purpose, because a replayed run is a function
of the commit and the committed cache and a wall clock would add diff noise without
adding anything reproducible.
