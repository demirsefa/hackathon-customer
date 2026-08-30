# scenarios/

Timed message streams for `src/sim/`.

**Nothing is committed here yet.** The scenario player is a placeholder, so the two
files below are named rather than written, and `yarn sim overload` says so and exits
non-zero rather than reporting a run.

- `normal-day.json` — arrival volume the operator can absorb.
- `overload.json` — arrival volume that exceeds capacity, which is where
  ordering quality starts to matter.

A scenario defines _when_ each message arrives; the cases themselves come from
`fixtures/`.
