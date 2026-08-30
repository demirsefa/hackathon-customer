/**
 * The read-first order of the operator's queue.
 *
 * She takes whatever is at the top (dev/CHALLENGE.md §10) and never re-decides, so the
 * order *is* the design being measured: under overload the metric reports which cases
 * the ordering put inside her capacity, not how many cases there were.
 *
 * The first key is not urgency but whether the case can still be reached in time. A
 * case whose coverage window has already closed cannot be reached in time no matter
 * when it is opened, so opening it ahead of one that still can is a trade the operator
 * loses twice: the late case is late either way, and the case behind it joins it.
 * Nothing is dropped — a closed window sends a case to the back of the queue, never
 * out of it, and the runs behind the published numbers open every case they queue.
 *
 * Whether the window has closed is decided by the caller and handed in, because it
 * needs a clock and a working calendar and `core/` reads neither. The window itself is
 * `CRITICAL_COVERAGE_MINUTES` in `policy.ts` — the same number the metric is scored on,
 * which is stated here rather than left to be discovered: this queue is written to the
 * desk's own service window, and a reader who finds that out on their own is entitled
 * to wonder what else was not said.
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
export interface QueueEntry {
  /** Unique within a scenario, which is what makes the order total. */
  readonly messageId: string;
  /** Higher is read earlier. `Decision.priority`, on its 0-100 scale. */
  readonly priority: number;
  /** Arrival instant as epoch milliseconds: integers, and directly comparable. */
  readonly arrivedAtMs: number;
  /**
   * Working minutes left in this case's coverage window; zero or less means the
   * window has already closed. Optional because a caller with no clock — the log
   * renderer — has nothing to answer it with, and a queue nobody is being served from
   * has neither lost causes nor deadlines in it.
   */
  readonly minutesLeft?: number;
}

/** A window nobody answered for is open: a caller with no clock cannot have missed one. */
function windowClosed(entry: QueueEntry): boolean {
  return (entry.minutesLeft ?? Number.POSITIVE_INFINITY) <= 0;
}

/**
 * Still reachable first, then priority descending, then arrival ascending, then
 * `messageId` ascending.
 *
 * The last key compares with `<` and `>` rather than `localeCompare`, because the
 * published number must not depend on the locale of the machine that produced it.
 */
export function compareQueueEntries(left: QueueEntry, right: QueueEntry): number {
  const leftLost = windowClosed(left);
  const rightLost = windowClosed(right);
  if (leftLost !== rightLost) {
    return leftLost ? 1 : -1;
  }
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

/**
 * The case to open next: the order above, except when waiting in it would lose one.
 *
 * The order answers "who is worth the most", which is the right question only while
 * everyone in the queue will still be there when their turn comes. Under overload they
 * will not. A case's turn arrives after everything ranked above it has been served, so
 * the minutes until then are already known — the count ahead of it times the minutes a
 * case takes — and a case whose window closes inside that gap is one the order is about
 * to lose while ranking it correctly.
 *
 * So: serve the highest-ranked case that would not survive its own place in the queue,
 * and otherwise serve the top. There is no threshold to tune here and none to defend —
 * the horizon each case is judged against is the queue's own length ahead of it. A
 * rescued case is served early, never twice, and nothing is dropped.
 */
export function nextToOpen<T extends QueueEntry>(
  entries: readonly T[],
  minutesPerCase: number,
): T | undefined {
  const ordered = sortedQueue(entries);

  const doomed = ordered.find(
    (entry, index) =>
      !windowClosed(entry) &&
      (entry.minutesLeft ?? Number.POSITIVE_INFINITY) < (index + 1) * minutesPerCase,
  );

  return doomed ?? ordered[0];
}
