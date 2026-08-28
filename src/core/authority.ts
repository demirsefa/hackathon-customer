/**
 * The authority gate.
 *
 * Runs on the record layer alone, before any model call, and its verdict is final:
 * no later stage may lift a message it holds. A support message can be entirely
 * legitimate — real sender, plausible request, no rule broken — and still be an
 * authority violation, because the sender does not own what they are asking about.
 * That fact is not in the text, so no amount of reading the text can find it.
 */
import { humanReview, type Decision } from './decision.ts';
import { extractOrderReferences, type InboundMessage } from './message.ts';
import type { Order, RecordStore } from './records.ts';

export type AuthorityOutcome =
  /** Nothing in the message points at a record, so there is nothing to own. */
  | { readonly kind: 'no_reference' }
  | { readonly kind: 'owned'; readonly orders: readonly Order[] }
  | { readonly kind: 'authority_mismatch'; readonly orderId: string }
  | { readonly kind: 'unresolved_reference'; readonly reference: string }
  | { readonly kind: 'unknown_sender'; readonly senderId: string };

/**
 * References are checked in the order they appear, and the first blocking outcome
 * wins, so the same message always yields the same verdict.
 */
export function resolveAuthority(
  message: InboundMessage,
  records: RecordStore,
): AuthorityOutcome {
  if (records.findSender(message.senderId) === undefined) {
    return { kind: 'unknown_sender', senderId: message.senderId };
  }

  const references = extractOrderReferences(message.text);
  if (references.length === 0) {
    return { kind: 'no_reference' };
  }

  const owned: Order[] = [];
  for (const reference of references) {
    const order = records.findOrder(reference);

    // A reference that resolves to nothing is not noise, it is uncertainty: the
    // sender may have mistyped, or may be probing for an order that is not theirs.
    if (order === undefined) {
      return { kind: 'unresolved_reference', reference };
    }

    if (order.ownerSenderId !== message.senderId) {
      return { kind: 'authority_mismatch', orderId: order.orderId };
    }

    owned.push(order);
  }

  return { kind: 'owned', orders: owned };
}

/**
 * Turns an authority outcome into a decision, or `null` when the message is free to
 * continue into the classification stage. Returning a `Decision` here is what makes
 * "zero model calls" observable: the gate answers before any client is touched.
 */
export function gateOnAuthority(
  messageId: string,
  outcome: AuthorityOutcome,
): Decision | null {
  switch (outcome.kind) {
    case 'unknown_sender':
      return humanReview({ messageId, reason: 'unknown_sender', llmCalls: 0 });
    case 'authority_mismatch':
      return humanReview({ messageId, reason: 'authority_mismatch', llmCalls: 0 });
    case 'unresolved_reference':
      return humanReview({ messageId, reason: 'unresolved_reference', llmCalls: 0 });
    case 'no_reference':
    case 'owned':
      return null;
  }
}

/** The order ids a reply to this message is allowed to mention. */
export function permittedOrderIds(outcome: AuthorityOutcome): readonly string[] {
  return outcome.kind === 'owned' ? outcome.orders.map((order) => order.orderId) : [];
}
