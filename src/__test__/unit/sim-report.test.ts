/**
 * The terminal output of the scenario player.
 *
 * The one rule worth a check: the headline number is the first thing under the title
 * and the cases she never reached are printed by id underneath it. A coverage figure
 * with no ids beside it is a percentage nobody can act on.
 */
import { describe, expect, it } from 'vitest';

import { playedLine, reportLines, windowLabel } from '../../sim/report.ts';
import type { Coverage } from '../../sim/score.ts';

const COVERAGE: Coverage = {
  pipeline: 'baseline',
  scenario: 'overload',
  arrivals: 90,
  windowMinutes: 240,
  critical: 42,
  criticalReached: 13,
  missed: [
    {
      messageId: 'M-0011',
      caseId: 'auth-01',
      arrivedAt: '2026-09-07T09:00:00+03:00',
      reason: 'auto_sent',
      waitedWorkingMinutes: null,
    },
    {
      messageId: 'M-0040',
      caseId: 'auth-01',
      arrivedAt: '2026-09-07T10:00:00+03:00',
      reason: 'auto_sent',
      waitedWorkingMinutes: null,
    },
    {
      messageId: 'M-0031',
      caseId: 'inj-05',
      arrivedAt: '2026-09-07T09:30:00+03:00',
      reason: 'not_reached',
      waitedWorkingMinutes: null,
    },
  ],
  queued: 22,
  opened: 22,
  stillQueued: 0,
  averageWaitMinutes: 63,
  interimSent: 19,
  llmCalls: 90,
};

const lines = reportLines(COVERAGE);
const text = lines.join('\n');

describe('reportLines', () => {
  it('names the line, the scenario and how much arrived', () => {
    expect(lines[0]).toBe('baseline — overload · 90 arrival(s)');
  });

  it('puts the metric first, with the window it was measured over', () => {
    expect(lines[2]).toContain('CRITICAL COVERAGE');
    expect(lines[2]).toContain('13 / 42');
    expect(lines[2]).toContain('(31%)');
    expect(lines[2]).toContain('4 working hour(s)');
  });

  it('prints the missed cases by id, collapsed, so the number can be acted on', () => {
    expect(text).toContain('2 case(s)');
    expect(text).toContain('auth-01, inj-05');
  });

  it('reports the queue, the wait and the interim messages', () => {
    expect(text).toContain('held for the operator     22 of 90');
    expect(text).toContain('still queued              0');
    expect(text).toContain('average wait              63 working minute(s)');
    expect(text).toContain('interim messages sent     19');
    expect(text).toContain('90 total, 1.00 per arrival');
  });

  it('says nothing was missed rather than printing an empty list', () => {
    const clean = reportLines({ ...COVERAGE, missed: [], criticalReached: 42 });
    expect(clean.join('\n')).toContain('none');
  });

  it('writes a dash where there is no average to report', () => {
    const idle = reportLines({ ...COVERAGE, averageWaitMinutes: null });
    expect(idle.join('\n')).toContain('average wait              —');
  });
});

describe('windowLabel', () => {
  it('says hours when the window is whole hours', () => {
    expect(windowLabel(240)).toBe('4 working hour(s)');
  });

  it('falls back to minutes rather than rounding one away', () => {
    expect(windowLabel(90)).toBe('90 working minute(s)');
  });
});

describe('playedLine', () => {
  /**
   * No duration, unlike the line `src/eval/` prints. This program produces the
   * published number and reads no clock anywhere, so its summary says what it did.
   */
  it('says what was played and carries no elapsed time', () => {
    const line = playedLine({ pipeline: 'baseline', scenario: 'overload', arrivals: 90 });

    expect(line).toBe('baseline: 90 arrival(s) of overload played');
    expect(line).not.toMatch(/\ds\b/);
  });
});
