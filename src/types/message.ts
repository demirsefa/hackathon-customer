/**
 * The message as it arrives from the queue.
 *
 * The split between the envelope and `text` is the security boundary of the whole
 * project: `senderId` and `receivedAt` are attested by the transport, `text` is
 * attested by nobody.
 */

export interface InboundMessage {
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
}
