/**
 * The operator's calendar. Every instant here is written with an explicit `+03:00`
 * offset so the test states the wall clock it means, rather than borrowing whatever
 * zone the machine running it happens to be in — which is the same reason
 * `timezone` is a required field.
 *
 * The week used throughout: Mon 2026-03-02 … Fri 2026-03-06, then Sat 07 and Sun 08.
 */
import { describe, expect, it } from 'vitest';

import {
  casesPerDay,
  isWorking,
  nextWorkingMinute,
  parseOperatorConfig,
  workingMinutesBetween,
  workingMinutesPerDay,
} from '../../core/operator.ts';

/** Merve's real desk: dev/CHALLENGE.md §10. */
const MERVE = parseOperatorConfig({
  id: 'merve',
  minutesPerCase: 10,
  shift: { start: '09:00', end: '17:00' },
  breaks: [['12:00', '13:00']],
  workdays: [1, 2, 3, 4, 5],
  timezone: 'Europe/Istanbul',
});

/** Her wall clock, stated as an instant. */
function istanbul(day: string, time: string): Date {
  return new Date(`2026-03-${day}T${time}:00+03:00`);
}

describe('isWorking', () => {
  it('is at the queue mid-morning on a working day', () => {
    expect(isWorking(MERVE, istanbul('02', '10:00'))).toBe(true);
  });

  it('is away during the lunch break', () => {
    expect(isWorking(MERVE, istanbul('02', '12:30'))).toBe(false);
  });

  it('is away after the shift ends', () => {
    expect(isWorking(MERVE, istanbul('02', '17:30'))).toBe(false);
  });

  it('is away before the shift starts', () => {
    expect(isWorking(MERVE, istanbul('02', '08:59'))).toBe(false);
  });

  /** Half-open spans: the boundary belongs to whatever starts at it. */
  it('treats the shift boundaries as start-inclusive and end-exclusive', () => {
    expect(isWorking(MERVE, istanbul('02', '09:00'))).toBe(true);
    expect(isWorking(MERVE, istanbul('02', '17:00'))).toBe(false);
  });

  it('treats the break boundaries the same way: 12:00 is gone, 13:00 is back', () => {
    expect(isWorking(MERVE, istanbul('02', '12:00'))).toBe(false);
    expect(isWorking(MERVE, istanbul('02', '13:00'))).toBe(true);
  });

  it('does not work on Saturday or Sunday', () => {
    expect(isWorking(MERVE, istanbul('07', '10:00'))).toBe(false);
    expect(isWorking(MERVE, istanbul('08', '10:00'))).toBe(false);
  });

  /**
   * The classic off-by-one: `Date#getDay()` calls Sunday 0, ISO calls it 7. A desk
   * that works Sundays only must work on Sunday and rest on Monday.
   */
  it('reads workdays as ISO numbers, so 7 is Sunday and not Monday', () => {
    const sundayDesk = parseOperatorConfig({
      id: 'sunday-desk',
      minutesPerCase: 10,
      shift: { start: '09:00', end: '17:00' },
      breaks: [],
      workdays: [7],
      timezone: 'Europe/Istanbul',
    });

    expect(isWorking(sundayDesk, istanbul('08', '10:00'))).toBe(true);
    expect(isWorking(sundayDesk, istanbul('02', '10:00'))).toBe(false);
  });

  /** The same instant, two zones, two answers. This is what the field buys. */
  it("answers in the configured zone, not the machine's", () => {
    const utcDesk = parseOperatorConfig({
      id: 'utc-desk',
      minutesPerCase: 10,
      shift: { start: '09:00', end: '17:00' },
      breaks: [['12:00', '13:00']],
      workdays: [1, 2, 3, 4, 5],
      timezone: 'UTC',
    });

    // 17:30 in Istanbul is 14:30 in UTC: she has gone home, the UTC desk has not.
    const instant = istanbul('02', '17:30');
    expect(isWorking(MERVE, instant)).toBe(false);
    expect(isWorking(utcDesk, instant)).toBe(true);
  });
});

describe('nextWorkingMinute', () => {
  it('hands back the instant itself when she is already at the queue', () => {
    const instant = istanbul('02', '10:00');
    expect(nextWorkingMinute(MERVE, instant).toISOString()).toBe(instant.toISOString());
  });

  it('waits out the lunch break', () => {
    expect(nextWorkingMinute(MERVE, istanbul('02', '12:30')).toISOString()).toBe(
      istanbul('02', '13:00').toISOString(),
    );
  });

  it('opens the desk for a message that arrived before the shift', () => {
    expect(nextWorkingMinute(MERVE, istanbul('02', '06:00')).toISOString()).toBe(
      istanbul('02', '09:00').toISOString(),
    );
  });

  it('carries an evening arrival to the next morning', () => {
    expect(nextWorkingMinute(MERVE, istanbul('02', '17:30')).toISOString()).toBe(
      istanbul('03', '09:00').toISOString(),
    );
  });

  /** The jump the metric exists to notice: the case sat unread all weekend. */
  it('jumps Friday 17:00 to Monday 09:00', () => {
    expect(nextWorkingMinute(MERVE, istanbul('06', '17:00')).toISOString()).toBe(
      istanbul('09', '09:00').toISOString(),
    );
  });

  it('opens the desk on Monday for a Saturday arrival', () => {
    expect(nextWorkingMinute(MERVE, istanbul('07', '11:00')).toISOString()).toBe(
      istanbul('09', '09:00').toISOString(),
    );
  });
});

describe('workingMinutesBetween', () => {
  it('counts a full working day as 420 minutes', () => {
    expect(
      workingMinutesBetween(MERVE, istanbul('02', '09:00'), istanbul('02', '17:00')),
    ).toBe(420);
  });

  /** Midnight to midnight is the same 420: the rest of the day is not hers. */
  it('counts only the shift when handed a whole calendar day', () => {
    expect(
      workingMinutesBetween(MERVE, istanbul('02', '00:00'), istanbul('03', '00:00')),
    ).toBe(420);
  });

  it('cuts the break out of the middle', () => {
    expect(
      workingMinutesBetween(MERVE, istanbul('02', '11:30'), istanbul('02', '13:30')),
    ).toBe(60);
  });

  it('spends nothing between Friday 17:00 and Monday 09:00', () => {
    expect(
      workingMinutesBetween(MERVE, istanbul('06', '17:00'), istanbul('09', '09:00')),
    ).toBe(0);
  });

  it('skips the weekend when the range spans it', () => {
    expect(
      workingMinutesBetween(MERVE, istanbul('06', '09:00'), istanbul('09', '17:00')),
    ).toBe(840);
  });

  it('adds up consecutive working days', () => {
    expect(
      workingMinutesBetween(MERVE, istanbul('02', '09:00'), istanbul('03', '17:00')),
    ).toBe(840);
  });

  it('is zero when the range is empty or runs backwards', () => {
    expect(
      workingMinutesBetween(MERVE, istanbul('02', '10:00'), istanbul('02', '10:00')),
    ).toBe(0);
    expect(
      workingMinutesBetween(MERVE, istanbul('02', '11:00'), istanbul('02', '10:00')),
    ).toBe(0);
  });
});

describe('capacity', () => {
  /** 420 minutes at 10 each, against the 60–80 a morning brings. */
  it('is 420 minutes and 42 cases a day', () => {
    expect(workingMinutesPerDay(MERVE)).toBe(420);
    expect(casesPerDay(MERVE)).toBe(42);
  });
});

describe('parseOperatorConfig', () => {
  it('keeps the desk as written', () => {
    expect(MERVE).toEqual({
      id: 'merve',
      minutesPerCase: 10,
      shift: { startMinute: 540, endMinute: 1020 },
      breaks: [{ startMinute: 720, endMinute: 780 }],
      workdays: [1, 2, 3, 4, 5],
      timezone: 'Europe/Istanbul',
    });
  });

  const valid = {
    id: 'merve',
    minutesPerCase: 10,
    shift: { start: '09:00', end: '17:00' },
    breaks: [['12:00', '13:00']],
    workdays: [1, 2, 3, 4, 5],
    timezone: 'Europe/Istanbul',
  };

  const rejected: readonly (readonly [string, unknown])[] = [
    ['a missing timezone', { ...valid, timezone: undefined }],
    ['a timezone no runtime knows', { ...valid, timezone: 'Mars/Olympus' }],
    [
      'a shift that ends before it starts',
      { ...valid, shift: { start: '17:00', end: '09:00' } },
    ],
    ['a shift of zero length', { ...valid, shift: { start: '09:00', end: '09:00' } }],
    [
      'a time that is not on the clock',
      { ...valid, shift: { start: '9:00', end: '17:00' } },
    ],
    ['a break outside the shift', { ...valid, breaks: [['08:00', '09:30']] }],
    [
      'breaks that overlap',
      {
        ...valid,
        breaks: [
          ['12:00', '13:00'],
          ['12:30', '14:00'],
        ],
      },
    ],
    ['breaks that swallow the shift', { ...valid, breaks: [['09:00', '17:00']] }],
    ['a weekday outside 1–7', { ...valid, workdays: [0, 1, 2] }],
    ['a weekday listed twice', { ...valid, workdays: [1, 1, 2] }],
    ['no weekdays at all', { ...valid, workdays: [] }],
    ['a fractional minutesPerCase', { ...valid, minutesPerCase: 2.5 }],
    ['a minutesPerCase of zero', { ...valid, minutesPerCase: 0 }],
    ['a config that is not an object', 'merve'],
  ];

  for (const [what, config] of rejected) {
    it(`refuses ${what}`, () => {
      expect(() => parseOperatorConfig(config)).toThrow(/operator config:/);
    });
  }
});
