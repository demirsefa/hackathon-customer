# scenarios/

Timed message streams for `src/sim/`.

- `normal-day.json` — arrival volume the operator can absorb.
- `overload.json` — arrival volume that exceeds capacity, which is where
  ordering quality starts to matter.

A scenario defines _when_ each message arrives; the cases themselves come from
`fixtures/`.
