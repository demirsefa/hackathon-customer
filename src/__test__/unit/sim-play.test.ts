/**
 * The player: the operator working her queue, and the interim message derived from what
 * she did not get to.
 *
 * `walkQueue` is exercised against arrivals written by hand — no scenario file, no
 * model, no cache. That is the whole reason it was split out of `playScenario`: the
 * primary metric is produced here, and a check on it that needs a network is a check
 * nobody runs.
 *
 * Every instant carries `+03:00`. The week used throughout: Mon 2026-03-02 … Fri
 * 2026-03-06, then Sat 07 and Sun 08.
 */
import { describe, expect, it } from 'vitest';

import { baseline } from '../../core/baseline/index.ts';
import { parseOperatorConfig } from '../../core/operator.ts';
import { createRecordStore } from '../../core/records.ts';
import type { ResolvedArrival } from '../../core/scenario.ts';
import { playScenario, walkQueue, type Pending } from '../../sim/play.ts';
import type { LlmClient } from '../../types/llm.ts';

const MERVE = parseOperatorConfig({
  id: 'merve',
  minutesPerCase: 10,
  shift: { start: '09:00', end: '17:00' },
  breaks: [['12:00', '13:00']],
  workdays: [1, 2, 3, 4, 5],
  timezone: 'Europe/Istanbul',
});

const at = (day: string, time: string): number =>
  Date.parse(`2026-03-${day}T${time}:00+03:00`);

const clock = (epochMs: number): string =>
  new Date(epochMs).toLocaleString('en-GB', {
    timeZone: 'Europe/Istanbul',
    hourCycle: 'h23',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const pending = (input: {
  readonly messageId: string;
  readonly priority: number;
  readonly arrivedAtMs: number;
  readonly queued?: boolean;
}): Pending => ({
  messageId: input.messageId,
  caseId: 'case',
  priority: input.priority,
  arrivedAtMs: input.arrivedAtMs,
  queued: input.queued ?? true,
});

/** Four working hours, the window the run's horizon is set by. */
const WINDOW = 240;

const walk = (arrivals: readonly Pending[]) =>
  walkQueue({ operator: MERVE, arrivals, windowMinutes: WINDOW });

describe('walkQueue', () => {
  it('starts at the first working minute at or after the earliest arrival', () => {
    // Friday 17:30: she has gone. Nothing happens until Monday.
    const result = walk([
      pending({ messageId: 'M-1', priority: 50, arrivedAtMs: at('06', '17:30') }),
    ]);

    expect(clock(result.startedAtMs)).toBe('09, 09:00');
    expect(result.openings[0]?.openedAtMs).toBe(at('09', '09:00'));
  });

  it('opens in queue order, not arrival order', () => {
    const result = walk([
      pending({ messageId: 'M-1', priority: 10, arrivedAtMs: at('02', '08:00') }),
      pending({ messageId: 'M-2', priority: 95, arrivedAtMs: at('02', '08:30') }),
      pending({ messageId: 'M-3', priority: 50, arrivedAtMs: at('02', '08:10') }),
    ]);

    expect(result.openings.map((one) => one.messageId)).toEqual(['M-2', 'M-3', 'M-1']);
  });

  /** The reason the comparator's third key exists, watched end to end. */
  it('settles an exact tie by message id rather than by input order', () => {
    const result = walk([
      pending({ messageId: 'M-9', priority: 55, arrivedAtMs: at('02', '08:00') }),
      pending({ messageId: 'M-1', priority: 55, arrivedAtMs: at('02', '08:00') }),
    ]);

    expect(result.openings.map((one) => one.messageId)).toEqual(['M-1', 'M-9']);
  });

  it('spends ten of her minutes on each case, stepping over the break', () => {
    const arrivals = ['M-1', 'M-2', 'M-3'].map((messageId, index) =>
      pending({ messageId, priority: 90 - index, arrivedAtMs: at('02', '11:00') }),
    );

    const result = walkQueue({
      operator: parseOperatorConfig({
        id: 'merve',
        minutesPerCase: 10,
        shift: { start: '11:45', end: '17:00' },
        breaks: [['12:00', '13:00']],
        workdays: [1, 2, 3, 4, 5],
        timezone: 'Europe/Istanbul',
      }),
      arrivals,
      windowMinutes: WINDOW,
    });

    expect(result.openings.map((one) => clock(one.openedAtMs))).toEqual([
      '02, 11:45',
      '02, 11:55',
      '02, 13:05',
    ]);
  });

  it('counts the wait in working minutes, so a weekend costs nothing', () => {
    const result = walk([
      pending({ messageId: 'M-1', priority: 50, arrivedAtMs: at('06', '17:30') }),
    ]);

    expect(result.openings[0]?.waitedWorkingMinutes).toBe(0);
  });

  it('never hands her a case that has not arrived yet', () => {
    const result = walk([
      pending({ messageId: 'M-1', priority: 10, arrivedAtMs: at('02', '09:00') }),
      pending({ messageId: 'M-2', priority: 95, arrivedAtMs: at('02', '14:00') }),
    ]);

    // The urgent one wins the queue but only from 14:00; at 09:00 there is one message.
    expect(result.openings.map((one) => [one.messageId, clock(one.openedAtMs)])).toEqual([
      ['M-1', '02, 09:00'],
      ['M-2', '02, 14:00'],
    ]);
  });

  it('leaves an auto-sent arrival out of the queue entirely', () => {
    const result = walk([
      pending({
        messageId: 'M-1',
        priority: 95,
        arrivedAtMs: at('02', '09:00'),
        queued: false,
      }),
      pending({ messageId: 'M-2', priority: 10, arrivedAtMs: at('02', '09:00') }),
    ]);

    expect(result.openings.map((one) => one.messageId)).toEqual(['M-2']);
  });

  /**
   * The horizon: four working hours after the last arrival. Past it no queued case can
   * still be reached in time, so the run stops and whatever is left is "still queued".
   */
  it('stops at the horizon and leaves the rest of the queue unopened', () => {
    const arrivals = Array.from({ length: 60 }, (_unused, index) =>
      pending({
        messageId: `M-${String(index).padStart(2, '0')}`,
        priority: 50,
        arrivedAtMs: at('02', '09:00'),
      }),
    );

    const result = walk(arrivals);

    // 240 working minutes at ten minutes a case: twenty-four of the sixty.
    expect(result.openings).toHaveLength(24);
    expect(clock(result.horizonMs)).toBe('02, 14:00');
  });

  it('refuses a scenario with no arrivals rather than inventing a timeline', () => {
    expect(() => walk([])).toThrow(/no arrivals/);
  });
});

/**
 * `playScenario` end to end, over a line that is asked to hold some arrivals and
 * auto-send others.
 *
 * The model client here is a one-off: `fakes.ts` answers every prompt the same way,
 * and what these checks need is one run in which the two routes both happen — a queued
 * case gets an interim message and an auto-sent one never can, because there is no
 * queue for it to sit in.
 */
const answers: LlmClient = {
  complete(request) {
    // `refund` is on the sensitive list, so the baseline holds it; anything else it
    // answers automatically. The urgency doubles as the queue's priority.
    const sensitive = request.prompt.includes('IADE');
    return Promise.resolve({
      text: JSON.stringify({
        category: sensitive ? 'refund' : 'order_status',
        urgency: sensitive ? 80 : 20,
        draft: 'Merhaba, mesajınızı aldık.',
      }),
    });
  },
};

const records = createRecordStore({ orders: [], senders: [] });

const resolved = (input: {
  readonly messageId: string;
  readonly at: string;
  readonly sensitive: boolean;
  readonly critical?: boolean;
}): ResolvedArrival => ({
  messageId: input.messageId,
  caseId: input.sensitive ? 'ref-01' : 'norm-01',
  subset: 'normal',
  critical: input.critical ?? false,
  arrivedAt: input.at,
  message: {
    messageId: input.messageId,
    senderId: 'S-ARAS',
    receivedAt: input.at,
    text: input.sensitive ? 'IADE istiyorum' : 'kargo nerede',
  },
});

const play = (arrivals: readonly ResolvedArrival[]) =>
  playScenario({
    pipeline: baseline,
    scenario: 'test',
    operator: MERVE,
    arrivals,
    records,
    llm: answers,
    windowMinutes: WINDOW,
  });

describe('playScenario', () => {
  it('hands the line one message at a time, in arrival order', async () => {
    const seen: string[] = [];

    await playScenario({
      pipeline: baseline,
      scenario: 'test',
      operator: MERVE,
      arrivals: [
        resolved({ messageId: 'M-1', at: '2026-03-02T09:00:00+03:00', sensitive: true }),
        resolved({ messageId: 'M-2', at: '2026-03-02T09:05:00+03:00', sensitive: false }),
      ],
      records,
      llm: answers,
      windowMinutes: WINDOW,
      onArrival: (arrival) =>
        seen.push(
          `${String(arrival.done)}/${String(arrival.total)} ${arrival.messageId}`,
        ),
    });

    expect(seen).toEqual(['1/2 M-1', '2/2 M-2']);
  });

  it('opens what was held and never sees what was auto-sent', async () => {
    const timeline = await play([
      resolved({ messageId: 'M-1', at: '2026-03-02T09:00:00+03:00', sensitive: true }),
      resolved({ messageId: 'M-2', at: '2026-03-02T09:00:00+03:00', sensitive: false }),
    ]);

    const [held, sent] = timeline.played;
    expect(held?.decision.route).toBe('human_review');
    expect(held?.openedAt).toBe(new Date('2026-03-02T09:00:00+03:00').toISOString());
    expect(sent?.decision.route).toBe('auto_send');
    expect(sent?.openedAt).toBeNull();
    expect(sent?.waitedWorkingMinutes).toBeNull();
  });

  it('sends no interim on a case she reaches inside the threshold', async () => {
    const timeline = await play([
      resolved({ messageId: 'M-1', at: '2026-03-02T09:00:00+03:00', sensitive: true }),
    ]);

    expect(timeline.played[0]?.interimAt).toBeNull();
  });

  /**
   * Wall-clock, unlike everything else here. The threshold is 30 minutes and this case
   * waits behind four others, so she reaches it 40 minutes in — and the customer has
   * been told at 09:30 that the message arrived.
   */
  it('sends one at the threshold when she has not looked yet, and leaves the case queued', async () => {
    const timeline = await play(
      ['M-1', 'M-2', 'M-3', 'M-4', 'M-5'].map((messageId) =>
        resolved({ messageId, at: '2026-03-02T09:00:00+03:00', sensitive: true }),
      ),
    );

    const last = timeline.played[4];
    expect(last?.interimAt).toBe(new Date('2026-03-02T09:30:00+03:00').toISOString());
    expect(last?.openedAt).toBe(new Date('2026-03-02T09:40:00+03:00').toISOString());
    // Still hers to answer: the interim moved nothing.
    expect(last?.decision.requiresApproval).toBe(true);
  });

  it('never sends one for an arrival that was answered automatically', async () => {
    const timeline = await play([
      resolved({ messageId: 'M-1', at: '2026-03-06T18:00:00+03:00', sensitive: false }),
    ]);

    expect(timeline.played[0]?.decision.route).toBe('auto_send');
    expect(timeline.played[0]?.interimAt).toBeNull();
  });

  /** A weekend arrival: she is three days away, and the sender hears back in thirty minutes. */
  it('sends one over a weekend, on the customer’s clock rather than on her shift', async () => {
    const timeline = await play([
      resolved({ messageId: 'M-1', at: '2026-03-07T11:00:00+03:00', sensitive: true }),
    ]);

    expect(timeline.played[0]?.interimAt).toBe(
      new Date('2026-03-07T11:30:00+03:00').toISOString(),
    );
    expect(timeline.played[0]?.openedAt).toBe(
      new Date('2026-03-09T09:00:00+03:00').toISOString(),
    );
    expect(timeline.played[0]?.waitedWorkingMinutes).toBe(0);
  });

  it('states the window it was played against rather than leaving it to be inferred', async () => {
    const timeline = await play([
      resolved({ messageId: 'M-1', at: '2026-03-02T09:00:00+03:00', sensitive: true }),
    ]);

    expect(timeline.windowMinutes).toBe(WINDOW);
    expect(timeline.operator.id).toBe('merve');
    expect(timeline.scenario).toBe('test');
    expect(timeline.pipeline).toBe('baseline');
  });
});
