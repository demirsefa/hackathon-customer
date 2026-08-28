/**
 * The decision vocabulary. Two things are pinned here: the approval invariant
 * `src/service/` depends on, and the fact that a line's own priority score can never
 * push a case outside the scale the queue is sorted on.
 */
import { describe, expect, it } from 'vitest';

import { autoSend, honoursApprovalGate, humanReview } from '../../core/decision.ts';

describe('humanReview', () => {
  it('takes the score of the reason when the line offers none', () => {
    const decision = humanReview({
      messageId: 'M-1',
      reason: 'authority_mismatch',
      llmCalls: 0,
    });

    expect(decision.priority).toBe(95);
    expect(decision.requiresApproval).toBe(true);
  });

  it('takes the score the line offers, clamped to the scale', () => {
    const offered = (priority: number): number =>
      humanReview({
        messageId: 'M-1',
        reason: 'sensitive_category',
        priority,
        llmCalls: 1,
      }).priority;

    expect(offered(42)).toBe(42);
    expect(offered(900)).toBe(100);
    expect(offered(-1)).toBe(0);
  });
});

describe('honoursApprovalGate', () => {
  it('holds for both routes', () => {
    expect(
      honoursApprovalGate(
        humanReview({ messageId: 'M-1', reason: 'sensitive_category', llmCalls: 1 }),
      ),
    ).toBe(true);
    expect(
      honoursApprovalGate(autoSend({ messageId: 'M-1', draft: 'ok', llmCalls: 1 })),
    ).toBe(true);
  });
});
