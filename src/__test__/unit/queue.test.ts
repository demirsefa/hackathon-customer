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

import { compareQueueEntries, sortedQueue, type QueueEntry } from '../../core/queue.ts';

const entry = (messageId: string, priority: number, arrivedAtMs: number): QueueEntry => ({
  messageId,
  priority,
  arrivedAtMs,
});

describe('compareQueueEntries', () => {
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
