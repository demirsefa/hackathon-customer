/**
 * The message as it arrives from the queue.
 *
 * The split between the envelope and `text` is the security boundary of the whole
 * project: `senderId` and `receivedAt` are attested by the transport, `text` is
 * attested by nobody.
 */

export type InboundMessage = {
  readonly messageId: string;
  /** From the transport envelope. Never parsed out of `text`. */
  readonly senderId: string;
  readonly receivedAt: string;
  /** Untrusted. May supply a lookup key; may never supply an answer. */
  readonly text: string;
  /**
   * A model-written summary of earlier messages in the thread, when one exists.
   * Untrusted for the same reason `text` is: a claim repeated by a summariser is
   * still a claim made by the sender.
   */
  readonly threadSummary?: string;
};

const ORDER_REFERENCE = /\bORD-\d{4,}\b/gi;

/**
 * Pulls order references out of message text. The result is a set of lookup keys and
 * nothing more — whether the sender may hear about any of them is decided in
 * `authority.ts`, against the record layer.
 */
export function extractOrderReferences(text: string): readonly string[] {
  const found = text.match(ORDER_REFERENCE) ?? [];
  return [...new Set(found.map((reference) => reference.toUpperCase()))];
}
