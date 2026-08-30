# scenarios/

Timed message streams for [`src/sim/`](../src/sim/README.md). Committed data, not
build output: what `yarn sim` plays is the JSON in this folder, arrival by arrival.

| File              | Arrivals | What it is                                                                            |
| ----------------- | -------: | ------------------------------------------------------------------------------------- |
| `normal-day.json` |       45 | A plain weekday, Monday 7 September 2026. Volume a desk absorbs.                      |
| `overload.json`   |       90 | Friday evening, the weekend, and the Monday morning that lands on top of what waited. |

A scenario defines **when** each message arrives. What each message _says_ comes from
[`fixtures/cases.json`](../fixtures/README.md), and the two are joined by `caseId`.

```json
{
  "name": "overload",
  "operators": [
    {
      "id": "merve",
      "minutesPerCase": 10,
      "shift": { "start": "09:00", "end": "17:00" },
      "breaks": [["12:00", "13:00"]],
      "workdays": [1, 2, 3, 4, 5],
      "timezone": "Europe/Istanbul"
    }
  ],
  "arrivals": [
    { "messageId": "M-0001", "caseId": "auth-01", "at": "2026-09-04T17:00:00+03:00" }
  ]
}
```

`operators` is an array and the player accepts **exactly one** entry, refusing anything
else by name: the desk this project measures is one person (`dev/CHALLENGE.md` §6), and
quietly averaging two calendars would produce a number nobody agreed to.

Every `at` carries an explicit offset. Without one, "09:03" means whatever the machine
reading the file thinks it means, and the queue's order stops being reproducible.

## The same case arrives many times

**Said out loud rather than hidden:** the evaluation set holds 28 cases and `overload`
holds 90 arrivals, so each case arrives three or four times — the same `caseId`, a
different `messageId`, a different instant. `normal-day` repeats them once or twice.

That is the desk it models: the same twenty-eight problems all morning, from different
people, and a queue that has to order the copies as well as the originals. It is also
what makes the free run possible — a prompt is built from the message text alone, so a
repeat hashes to a cache key that is already recorded, and 28 committed responses cover
a 90-arrival run with no API key and no new calls.

Two consequences worth knowing before reading a number out of these files:

- **Ties are the normal case, not the edge case.** Every copy of one case carries the
  same priority, which is why the queue's order is total down to the message id.
- **A repeat is not new evidence.** A case the line gets wrong is counted once per
  arrival in the metric and collapsed back to one case id in the report, because
  `auth-01` was missed is a design gap and three message ids are the same gap counted
  three times.

## Regenerating them

```bash
node scripts/make-scenario.mjs
```

The generator is **not part of the measured path**. It has one fixed seed, no clock and
no `Math.random`, and its output is committed — so a judge reads the arrivals instead of
reconstructing them from a seed, and a change to the generator cannot move a published
number without showing up as a diff in this folder. Running it twice writes the same
bytes; regenerating is a no-op unless something was meant to change.

## Why `overload` starts on a Friday evening

Merve's day holds 420 working minutes, so at ten minutes a case she reaches 42
(`dev/CHALLENGE.md` §10). `overload` brings 90 arrivals across a Friday evening she has
already left, a weekend nobody is at the desk for, and a Monday whose own volume lands
on top of everything that waited — because what the metric measures is the _order_ of
the queue, and an order only matters once the queue outruns the day.

The weekend is not decoration. A message that arrives on Saturday spends none of her
budget until Monday 09:00, and whether the four-hour window it is judged against has
already closed by the time she reaches it is exactly the question
`workingMinutesBetween` exists to answer.
