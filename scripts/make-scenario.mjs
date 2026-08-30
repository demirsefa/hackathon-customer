/**
 * Writes `scenarios/normal-day.json` and `scenarios/overload.json`.
 *
 *   node scripts/make-scenario.mjs
 *
 * **This generator is not part of the measured path.** What `yarn sim` runs is the
 * committed JSON, arrival by arrival, with every instant written out in full — so a
 * judge reads the scenario rather than reconstructing it from a seed, and a change to
 * this file cannot move a published number without showing up as a diff in the data.
 * That is the whole reason the arrivals are listed instead of generated at run time.
 *
 * It is deterministic all the same: one fixed seed, one small PRNG, no clock and no
 * `Math.random`. Running it twice writes the same bytes, so regenerating is a no-op
 * unless something was actually meant to change.
 *
 * Standalone on purpose, like `leak-check.cjs` beside it: no imports from `src/`, no
 * dependencies, runnable before `yarn install` has ever been typed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Merve's desk, dev/CHALLENGE.md §10. Copied into every scenario file verbatim. */
const MERVE = {
  id: 'merve',
  minutesPerCase: 10,
  shift: { start: '09:00', end: '17:00' },
  breaks: [['12:00', '13:00']],
  workdays: [1, 2, 3, 4, 5],
  timezone: 'Europe/Istanbul',
};

/** Istanbul is +03 year round, and the scenarios are written on her clock. */
const OFFSET = '+03:00';

/**
 * Fixed, and the only source of variation in either file. Changing it rewrites both
 * scenarios, which is a deliberate act with a diff attached, not a run-to-run wobble.
 */
const SEED = 20260830;

/** mulberry32 — thirty-two bits of state, identical output on every engine. */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, drawing from `next`. Deterministic for a deterministic `next`. */
function shuffled(items, next) {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

/**
 * Case ids for `count` arrivals: every case used as evenly as the count allows, then
 * shuffled.
 *
 * Drawing each arrival independently would leave some cases unused and others piled up
 * — a lumpy set is a metric that reports the draw rather than the design. Repeats are
 * the point: the same twenty-eight problems arrive all morning under different message
 * ids, from the same senders, and the queue has to order the copies too.
 */
function spreadCases(caseIds, count, next) {
  const pool = [];
  while (pool.length < count) pool.push(...shuffled(caseIds, next));
  return shuffled(pool.slice(0, count), next);
}

/** A local wall-clock time on her calendar, written with its offset. */
function at(date, minuteOfDay) {
  const hours = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
  const minutes = String(minuteOfDay % 60).padStart(2, '0');
  return `${date}T${hours}:${minutes}:00${OFFSET}`;
}

/**
 * `count` instants inside `[startMinute, endMinute)` on `date`, spaced evenly and then
 * jittered by up to half a slot. Even spacing alone would make every arrival land on a
 * round number and every tie in the queue fall the same way; pure noise would cluster.
 */
function window(date, count, startMinute, endMinute, next) {
  const slot = (endMinute - startMinute) / count;
  const out = [];

  for (let index = 0; index < count; index += 1) {
    const centre = startMinute + slot * (index + 0.5);
    const jitter = (next() - 0.5) * slot;
    out.push(
      at(
        date,
        Math.round(Math.min(endMinute - 1, Math.max(startMinute, centre + jitter))),
      ),
    );
  }

  return out;
}

function scenario(name, caseIds, windows) {
  const next = random(SEED + name.length);

  const instants = windows
    .flatMap(([date, count, from, to]) => window(date, count, from, to, next))
    .sort();

  const cases = spreadCases(caseIds, instants.length, next);

  return {
    name,
    operators: [MERVE],
    arrivals: instants.map((instant, index) => ({
      messageId: `M-${String(index + 1).padStart(4, '0')}`,
      caseId: cases[index],
      at: instant,
    })),
  };
}

const caseIds = JSON.parse(
  readFileSync(`${REPO_ROOT}fixtures/cases.json`, 'utf8'),
).cases.map((entry) => entry.caseId);

/**
 * A plain weekday: Monday 7 September 2026. Forty-five messages, most of them inside
 * her shift, a few before she arrives. Volume a desk absorbs.
 */
const NORMAL_DAY = [
  ['2026-09-07', 6, 7 * 60, 9 * 60],
  ['2026-09-07', 22, 9 * 60, 13 * 60],
  ['2026-09-07', 17, 13 * 60, 18 * 60],
];

/**
 * The Monday morning the queue never empties. Ninety messages: a Friday evening that
 * arrives after she has gone, a weekend nobody is at the desk for, and a Monday whose
 * own volume lands on top of what was already waiting.
 *
 * Her capacity is 42 cases a day (420 working minutes at 10 minutes each), and this
 * exceeds it deliberately — dev/CHALLENGE.md §10: what the metric measures is the
 * *order* of the queue, and an order only matters once the queue outruns the day.
 */
const OVERLOAD = [
  ['2026-09-04', 12, 17 * 60, 23 * 60 + 30],
  ['2026-09-05', 18, 8 * 60, 22 * 60],
  ['2026-09-06', 16, 9 * 60, 22 * 60],
  ['2026-09-07', 30, 7 * 60, 12 * 60],
  ['2026-09-07', 14, 12 * 60, 17 * 60],
];

/**
 * The file as text, one arrival to a line.
 *
 * Hand-shaped rather than left to `JSON.stringify(value, null, 2)`, for two reasons
 * that turn out to be the same reason. Prettier runs over this folder — the files are
 * committed data a judge reads, not build output — and it collapses a short array onto
 * one line, so the default indentation would be rewritten the moment `yarn validation`
 * ran and the generator's output would stop matching what is committed. Written this
 * way the two agree, and ninety arrivals read as ninety lines instead of four hundred.
 */
function render(value) {
  const [merve] = value.operators;
  const quote = (text) => JSON.stringify(text);
  const pair = ([from, to]) => `[${quote(from)}, ${quote(to)}]`;

  const operator = [
    '    {',
    `      "id": ${quote(merve.id)},`,
    `      "minutesPerCase": ${String(merve.minutesPerCase)},`,
    `      "shift": { "start": ${quote(merve.shift.start)}, "end": ${quote(merve.shift.end)} },`,
    `      "breaks": [${merve.breaks.map(pair).join(', ')}],`,
    `      "workdays": [${merve.workdays.join(', ')}],`,
    `      "timezone": ${quote(merve.timezone)}`,
    '    }',
  ];

  const arrivals = value.arrivals.map(
    (one, index) =>
      `    { "messageId": ${quote(one.messageId)}, "caseId": ${quote(one.caseId)}, "at": ${quote(one.at)} }` +
      (index === value.arrivals.length - 1 ? '' : ','),
  );

  return [
    '{',
    `  "name": ${JSON.stringify(value.name)},`,
    '  "operators": [',
    ...operator,
    '  ],',
    '  "arrivals": [',
    ...arrivals,
    '  ]',
    '}',
    '',
  ].join('\n');
}

for (const [name, windows] of [
  ['normal-day', NORMAL_DAY],
  ['overload', OVERLOAD],
]) {
  const value = scenario(name, caseIds, windows);
  const text = render(value);

  // Parsed back before it is written. A renderer that builds text by hand can produce
  // something that is not JSON, and the failure would surface as an unreadable scenario
  // rather than as a broken generator.
  if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(value)) {
    throw new Error(`make-scenario: ${name} did not round-trip through its own output`);
  }

  writeFileSync(`${REPO_ROOT}scenarios/${name}.json`, text);
  console.log(`scenarios/${name}.json`);
}
