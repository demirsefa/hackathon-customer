# sim/

Timestamped scenario player. Feeds a scenario's messages through `core/` in
arrival order, advances a simulated clock, and models the operator working the
queue top-down.

This is where the primary metric is produced: how many of the messages that
truly needed attention were actually reached before capacity ran out.

```bash
yarn sim normal-day
yarn sim overload
```
