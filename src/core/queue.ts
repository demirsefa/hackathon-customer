/**
 * The read-first order of the operator's queue.
 *
 * She takes whatever is at the top (dev/CHALLENGE.md §10) and never re-decides, so the
 * order *is* the design being measured: under overload the metric reports which cases
 * the ordering put inside her capacity, not how many cases there were.
 *
 * The comparator is deliberately **total**. Priority alone leaves ties, and ties are
 * not rare here — one scenario replays the same case many times, and every copy of it
 * carries the same score. Which of two equally urgent cases lands inside the day's
 * forty-two is a difference the published number can see, so it may not be left to
 * `Array#sort` stability: stability preserves *input* order, and the input order of a
 * queue assembled from arrivals that are still coming in is not something a scenario
 * file states. The third key settles every remaining pair by name, and
 * `compareQueueEntries` therefore returns `0` only for two entries with the same
 * `messageId` — which a scenario cannot contain, because `parseScenario` rejects it.
 */

/** What ordering needs, and nothing else — so a test can build one in three fields. */
export type QueueEntry = {
  /** Unique within a scenario, which is what makes the order total. */
  readonly messageId: string;
  /** Higher is read earlier. `Decision.priority`, on its 0-100 scale. */
  readonly priority: number;
  /** Arrival instant as epoch milliseconds: integers, and directly comparable. */
  readonly arrivedAtMs: number;
};

/**
 * Priority descending, then arrival ascending, then `messageId` ascending.
 *
 * The last key compares with `<` and `>` rather than `localeCompare`, because the
 * published number must not depend on the locale of the machine that produced it.
 */
export function compareQueueEntries(left: QueueEntry, right: QueueEntry): number {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }
  if (left.arrivedAtMs !== right.arrivedAtMs) {
    return left.arrivedAtMs - right.arrivedAtMs;
  }
  if (left.messageId < right.messageId) return -1;
  return left.messageId > right.messageId ? 1 : 0;
}

/** The queue in reading order. A copy: the caller's array is never reordered. */
export function sortedQueue<T extends QueueEntry>(entries: readonly T[]): readonly T[] {
  return [...entries].sort(compareQueueEntries);
}
