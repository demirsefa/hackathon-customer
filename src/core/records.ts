/**
 * The record layer's one constructor: an in-memory store over already-attested rows.
 *
 * The vocabulary it is built from is declared in `types/records.ts`, and the rule
 * stated there holds here too — nothing a store answers with is ever derived from
 * message text.
 */
import type { Order, RecordStore, SenderProfile } from '../types/records.ts';

export function createRecordStore(input: {
  readonly orders: readonly Order[];
  readonly senders: readonly SenderProfile[];
}): RecordStore {
  const orders = new Map(input.orders.map((order) => [order.orderId, order]));
  const senders = new Map(input.senders.map((sender) => [sender.senderId, sender]));

  return {
    findOrder: (orderId) => orders.get(orderId),
    findSender: (senderId) => senders.get(senderId),
  };
}
