# src/service/

The real runtime path: an HTTP surface over `src/core/`, backed by an in-memory
queue. No database, no Redis — queue state is a plain module owned by the
process.

Consequential actions stay behind an explicit human approval step, per the
hackathon ground rules. Nothing is delivered to a customer without either an
automatic-send decision from `src/core/` or an approval call from the operator.

**Not written yet.** `yarn serve` says so and exits `1` rather than exiting `0` on a
line that reads like a server which started.
