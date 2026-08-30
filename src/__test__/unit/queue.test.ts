/**
 * The read-first order.
 *
 * The assertion that matters most here is not any single ordering — it is that the
 * comparator is **total**: no two distinct entries ever compare equal. Under overload
 * the queue is longer than the day, so which of two equally urgent cases lands inside
 * her capacity moves the published number, and `Array#sort` stability would settle it
 * by input order — an order no scenario file states.
 */
import { describe, expect, it } from 'vitest';

import {
  compareQueueEntries,
  nextToOpen,
  sortedQueue,
  type QueueEntry,
} from '../../core/queue.ts';

const entry = (messageId: string, priority: number, arrivedAtMs: number): QueueEntry => ({
  messageId,
  priority,
  arrivedAtMs,
});

/** The same entry, with its coverage window already closed. */
const lost = (messageId: string, priority: number, arrivedAtMs: number): QueueEntry => ({
  ...entry(messageId, priority, arrivedAtMs),
  minutesLeft: 0,
});

/** The same entry, with `minutesLeft` of its window still to run. */
const leaves = (
  messageId: string,
  priority: number,
  minutesLeft: number,
): QueueEntry => ({
  ...entry(messageId, priority, 0),
  minutesLeft,
});

describe('compareQueueEntries', () => {
  /**
   * Ahead of priority on purpose. A case that can no longer be reached in time scores
   * nothing whenever it is opened, so the minutes spent on it are taken from a case
   * that could still have been reached — which is the one trade this order exists to
   * refuse. It goes to the back, not out: the runs behind the published numbers open
   * every case they queue.
   */
  it('puts a case that can still be reached ahead of one that cannot', () => {
    expect(compareQueueEntries(lost('M-1', 95, 0), entry('M-2', 10, 0))).toBeGreaterThan(
      0,
    );
  });

  it('falls back to priority when both windows are equally open or equally shut', () => {
    expect(compareQueueEntries(lost('M-2', 50, 0), lost('M-1', 90, 0))).toBeGreaterThan(
      0,
    );
  });

  it('treats an unanswered window as open, for a caller with no clock', () => {
    expect(compareQueueEntries(entry('M-1', 90, 0), lost('M-2', 90, 0))).toBeLessThan(0);
  });

  it('puts the higher priority first', () => {
    expect(compareQueueEntries(entry('M-2', 50, 0), entry('M-1', 90, 0))).toBeGreaterThan(
      0,
    );
  });

  it('breaks a priority tie by arrival, earliest first', () => {
    expect(compareQueueEntries(entry('M-2', 80, 10), entry('M-1', 80, 20))).toBeLessThan(
      0,
    );
  });

  it('breaks a priority and arrival tie by message id', () => {
    expect(compareQueueEntries(entry('M-1', 80, 10), entry('M-2', 80, 10))).toBeLessThan(
      0,
    );
  });

  it('is equal only for two entries carrying the same message id', () => {
    expect(compareQueueEntries(entry('M-1', 80, 10), entry('M-1', 80, 10))).toBe(0);
  });
});

/**
 * The properties, over a list built to collide on every key that can collide: the same
 * priority repeated, the same instant repeated, and both together — which is what a
 * scenario replaying one case under many message ids actually produces.
 */
describe('the order is total over a colliding list', () => {
  const entries: readonly QueueEntry[] = [
    entry('M-0004', 55, 1000),
    entry('M-0001', 55, 1000),
    entry('M-0003', 55, 2000),
    entry('M-0002', 95, 3000),
    entry('M-0005', 95, 3000),
    entry('M-0006', 10, 1000),
    entry('M-0007', 55, 1000),
  ];

  const pairs = entries.flatMap((left, index) =>
    entries.slice(index + 1).map((right) => [left, right] as const),
  );

  it('never calls two distinct entries equal', () => {
    for (const [left, right] of pairs) {
      expect(
        compareQueueEntries(left, right),
        `${left.messageId} and ${right.messageId} compared equal`,
      ).not.toBe(0);
    }
  });

  it('is antisymmetric', () => {
    for (const [left, right] of pairs) {
      expect(Math.sign(compareQueueEntries(left, right))).toBe(
        -Math.sign(compareQueueEntries(right, left)),
      );
    }
  });

  it('is transitive across every ordered triple', () => {
    const sorted = sortedQueue(entries);

    for (let first = 0; first < sorted.length; first += 1) {
      for (let second = first + 1; second < sorted.length; second += 1) {
        const left = sorted[first];
        const right = sorted[second];
        if (left === undefined || right === undefined) continue;
        expect(compareQueueEntries(left, right)).toBeLessThan(0);
      }
    }
  });

  it('sorts by priority, then arrival, then message id', () => {
    expect(sortedQueue(entries).map((one) => one.messageId)).toEqual([
      'M-0002',
      'M-0005',
      'M-0001',
      'M-0004',
      'M-0007',
      'M-0003',
      'M-0006',
    ]);
  });

  it('leaves the caller’s array alone', () => {
    const original = [...entries];
    sortedQueue(entries);
    expect(entries).toEqual(original);
  });
});

/**
 * The rescue, which is the part of the order that cannot be a comparator: whether a
 * case survives its own place in the queue depends on how many cases are ahead of it,
 * and a comparator only ever sees two.
 */
describe('nextToOpen', () => {
  const TEN = 10;

  it('serves the top when everyone still fits inside their window', () => {
    const top = nextToOpen([leaves('M-1', 90, 500), leaves('M-2', 50, 500)], TEN);

    expect(top?.messageId).toBe('M-1');
  });

  it('serves a lower-ranked case that would not survive its own place', () => {
    // `M-2` is second, so its turn comes in 20 minutes and it has 15 left.
    const top = nextToOpen(
      [leaves('M-1', 90, 500), leaves('M-2', 50, 15), leaves('M-3', 40, 500)],
      TEN,
    );

    expect(top?.messageId).toBe('M-2');
  });

  it('rescues the highest-ranked of several that would be lost', () => {
    const top = nextToOpen([leaves('M-1', 90, 5), leaves('M-2', 80, 5)], TEN);

    expect(top?.messageId).toBe('M-1');
  });

  /** A closed window cannot be rescued, so it never jumps a case that can be. */
  it('never rescues a case whose window has already closed', () => {
    const top = nextToOpen([leaves('M-1', 10, 500), lost('M-2', 95, 0)], TEN);

    expect(top?.messageId).toBe('M-1');
  });

  it('has nothing to open when the queue is empty', () => {
    expect(nextToOpen([], TEN)).toBeUndefined();
  });
});
