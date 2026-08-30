/**
 * The scenario file as a value, and the join to the case set.
 *
 * Every instant here carries `+03:00` for the reason the operator's own tests give: a
 * test states the wall clock it means rather than borrowing the machine's.
 */
import { describe, expect, it } from 'vitest';

import type { EvaluationCase } from '../../core/cases.ts';
import { parseScenario, resolveArrivals } from '../../core/scenario.ts';

const MERVE = {
  id: 'merve',
  minutesPerCase: 10,
  shift: { start: '09:00', end: '17:00' },
  breaks: [['12:00', '13:00']],
  workdays: [1, 2, 3, 4, 5],
  timezone: 'Europe/Istanbul',
};

const scenarioFile = (arrivals: readonly unknown[]): unknown => ({
  name: 'test',
  operators: [MERVE],
  arrivals,
});

const arrival = (messageId: string, caseId: string, at: string): unknown => ({
  messageId,
  caseId,
  at,
});

describe('parseScenario', () => {
  it('returns the operator and the arrivals', () => {
    const scenario = parseScenario(
      scenarioFile([arrival('M-0001', 'auth-01', '2026-09-07T09:03:00+03:00')]),
    );

    expect(scenario.name).toBe('test');
    expect(scenario.operator.id).toBe('merve');
    expect(scenario.operator.minutesPerCase).toBe(10);
    expect(scenario.arrivals).toEqual([
      { messageId: 'M-0001', caseId: 'auth-01', at: '2026-09-07T09:03:00+03:00' },
    ]);
  });

  it('sorts arrivals by instant, then by message id', () => {
    const scenario = parseScenario(
      scenarioFile([
        arrival('M-0003', 'auth-01', '2026-09-07T10:00:00+03:00'),
        arrival('M-0002', 'auth-01', '2026-09-07T09:00:00+03:00'),
        arrival('M-0001', 'auth-01', '2026-09-07T09:00:00+03:00'),
      ]),
    );

    expect(scenario.arrivals.map((one) => one.messageId)).toEqual([
      'M-0001',
      'M-0002',
      'M-0003',
    ]);
  });

  it('refuses a timestamp with no offset, which would mean a different queue elsewhere', () => {
    expect(() =>
      parseScenario(scenarioFile([arrival('M-0001', 'auth-01', '2026-09-07T09:03:00')])),
    ).toThrow(/explicit offset/);
  });

  it('refuses a duplicate message id, which the queue order could not separate', () => {
    expect(() =>
      parseScenario(
        scenarioFile([
          arrival('M-0001', 'auth-01', '2026-09-07T09:00:00+03:00'),
          arrival('M-0001', 'auth-02', '2026-09-07T10:00:00+03:00'),
        ]),
      ),
    ).toThrow(/lists messageId "M-0001" twice/);
  });

  it('refuses an empty arrival list', () => {
    expect(() => parseScenario(scenarioFile([]))).toThrow(/must be a non-empty array/);
  });

  it('refuses more than one operator, and says why', () => {
    expect(() =>
      parseScenario({
        name: 'test',
        operators: [MERVE, MERVE],
        arrivals: [arrival('M-0001', 'auth-01', '2026-09-07T09:00:00+03:00')],
      }),
    ).toThrow(/exactly one operator/);
  });

  it('reports a broken calendar with both the field and the file', () => {
    expect(() =>
      parseScenario({
        name: 'test',
        operators: [{ ...MERVE, shift: { start: '17:00', end: '09:00' } }],
        arrivals: [arrival('M-0001', 'auth-01', '2026-09-07T09:00:00+03:00')],
      }),
    ).toThrow(/scenario file: operators\[0\] — operator config: shift\.start/);
  });
});

const testCase = (caseId: string, text: string): EvaluationCase => ({
  caseId,
  subset: 'authority',
  critical: true,
  expectedRoute: 'human_review',
  message: {
    messageId: 'M-019',
    senderId: 'S-ARAS',
    receivedAt: '2026-08-31T09:50:00+03:00',
    text,
  },
});

describe('resolveArrivals', () => {
  const cases = [testCase('auth-01', 'ORD-1042 hakkında'), testCase('auth-02', 'iade')];

  const scenario = parseScenario(
    scenarioFile([
      arrival('M-0001', 'auth-01', '2026-09-07T09:03:00+03:00'),
      arrival('M-0002', 'auth-01', '2026-09-07T11:00:00+03:00'),
    ]),
  );

  it('re-stamps the envelope with the arrival’s own identity', () => {
    const [first, second] = resolveArrivals({ scenario, cases });

    expect(first?.message.messageId).toBe('M-0001');
    expect(first?.message.receivedAt).toBe('2026-09-07T09:03:00+03:00');
    expect(second?.message.messageId).toBe('M-0002');
    expect(second?.message.receivedAt).toBe('2026-09-07T11:00:00+03:00');
  });

  /**
   * The reason twenty-eight recordings cover a ninety-arrival run: a prompt is built
   * from the text alone, so a repeat hashes to a key the cache already holds.
   */
  it('leaves the text untouched, so a repeat replays out of the same cache entry', () => {
    const resolved = resolveArrivals({ scenario, cases });
    expect(resolved.map((one) => one.message.text)).toEqual([
      'ORD-1042 hakkında',
      'ORD-1042 hakkında',
    ]);
  });

  it('carries the ground truth the metric is scored against', () => {
    const [first] = resolveArrivals({ scenario, cases });
    expect(first?.critical).toBe(true);
    expect(first?.subset).toBe('authority');
  });

  it('names every unknown case at once rather than one per run', () => {
    const unknown = parseScenario(
      scenarioFile([
        arrival('M-0001', 'nope-01', '2026-09-07T09:00:00+03:00'),
        arrival('M-0002', 'nope-02', '2026-09-07T10:00:00+03:00'),
        arrival('M-0003', 'nope-01', '2026-09-07T11:00:00+03:00'),
      ]),
    );

    expect(() => resolveArrivals({ scenario: unknown, cases })).toThrow(
      /no such case in the evaluation set: nope-01, nope-02/,
    );
  });
});
