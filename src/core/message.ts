/**
 * What is read out of a message: the instant its envelope must satisfy, and the
 * lookup keys its text may carry.
 *
 * The shape itself is declared in `types/message.ts`. What stays here is the reading,
 * and the boundary it respects: `text` is attested by nobody, so what is pulled out
 * of it is a key and never an answer.
 */

/**
 * An ISO instant carrying an explicit offset.
 *
 * It lives here rather than inside either parser that needs it. `receivedAt` on
 * `InboundMessage` is the instant this rule describes, and an arrival in
 * `scenario.ts` is the same instant seen from the other side — two copies of the rule
 * would become two rules the day one of them is relaxed. The offset is required
 * rather than assumed because a queue is ordered by arrival time, and a timestamp
 * without one means something different depending on which machine reads it.
 */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isInstant(value: string): boolean {
  return INSTANT.test(value);
}

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
