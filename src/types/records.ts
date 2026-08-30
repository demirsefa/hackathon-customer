/**
 * The record layer: the only place authority, ownership and identity are read from.
 *
 * Everything here is attested by the system that produced it. Nothing here is ever
 * derived from message text — that is the whole point of the layer existing.
 */

export type OrderStatus = 'placed' | 'shipped' | 'delivered' | 'refunded';

export interface Order {
  readonly orderId: string;
  /** The single source of truth for who may be told about this order. */
  readonly ownerSenderId: string;
  readonly status: OrderStatus;
}

export interface SenderProfile {
  readonly senderId: string;
  readonly displayName: string;
}

export interface RecordStore {
  findOrder(orderId: string): Order | undefined;
  findSender(senderId: string): SenderProfile | undefined;
}
