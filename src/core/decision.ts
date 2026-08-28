/**
 * The vocabulary every triage decision is expressed in.
 *
 * Decisions are only ever built through `humanReview` and `autoSend`. Priority and
 * the approval requirement are derived from the reason, so no caller can assemble a
 * held message that quietly claims it needs no approval — the one mistake that would
 * put an unreviewed reply in front of a customer.
 */

export type Route = 'auto_send' | 'human_review';

export type ReasonCode =
  | 'authority_mismatch'
  | 'unresolved_reference'
  | 'unknown_sender'
  | 'draft_policy_violation'
  | 'sensitive_category'
  | 'low_confidence'
  | 'model_output_unusable'
  | 'routine_reply';

/** Read-first order for the operator: higher is reached earlier under overload. */
const PRIORITY: Readonly<Record<ReasonCode, number>> = {
  authority_mismatch: 95,
  draft_policy_violation: 90,
  sensitive_category: 80,
  unknown_sender: 70,
  unresolved_reference: 60,
  model_output_unusable: 55,
  low_confidence: 50,
  routine_reply: 10,
};

export type Decision = {
  readonly messageId: string;
  readonly route: Route;
  readonly reason: ReasonCode;
  readonly priority: number;
  /** A proposed reply. Never delivered on its own — delivery goes through the gate. */
  readonly draft: string | null;
  readonly requiresApproval: boolean;
  /** How many model calls this decision cost. Zero is a meaningful answer. */
  readonly llmCalls: number;
};

export function humanReview(input: {
  readonly messageId: string;
  readonly reason: Exclude<ReasonCode, 'routine_reply'>;
  readonly draft?: string | null;
  readonly llmCalls: number;
}): Decision {
  return {
    messageId: input.messageId,
    route: 'human_review',
    reason: input.reason,
    priority: PRIORITY[input.reason],
    draft: input.draft ?? null,
    requiresApproval: true,
    llmCalls: input.llmCalls,
  };
}

export function autoSend(input: {
  readonly messageId: string;
  readonly draft: string;
  readonly llmCalls: number;
}): Decision {
  return {
    messageId: input.messageId,
    route: 'auto_send',
    reason: 'routine_reply',
    priority: PRIORITY.routine_reply,
    draft: input.draft,
    requiresApproval: false,
    llmCalls: input.llmCalls,
  };
}

/**
 * The invariant `service/` depends on: a held message always carries an approval
 * requirement, and an automatic send never claims one it does not have.
 */
export function honoursApprovalGate(decision: Decision): boolean {
  return decision.requiresApproval === (decision.route === 'human_review');
}

/** The decision's shape, for comparing two implementations against each other. */
export function decisionFields(decision: Decision): readonly string[] {
  return Object.keys(decision).sort();
}
