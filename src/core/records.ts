/**
 * The record layer: the only place authority, ownership and identity are read from.
 *
 * Everything here is attested by the system that produced it. Nothing here is ever
 * derived from message text — that is the whole point of the layer existing.
 */

export type OrderStatus = 'placed' | 'shipped' | 'delivered' | 'refunded';

export type Order = {
  readonly orderId: string;
  /** The single source of truth for who may be told about this order. */
  readonly ownerSenderId: string;
  readonly status: OrderStatus;
};

export type SenderProfile = {
  readonly senderId: string;
  readonly displayName: string;
};

export type RecordStore = {
  findOrder(orderId: string): Order | undefined;
  findSender(senderId: string): SenderProfile | undefined;
};

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
