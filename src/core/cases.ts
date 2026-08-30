/**
 * The evaluation set as a value: parsed, validated, typed. Nothing else.
 *
 * `core/` reads no files, so this takes already-decoded JSON and hands back the
 * record layer and the cases. The `readFile` belongs to whoever runs the set —
 * `src/eval/` — and the split is what keeps the set drivable from a test that has
 * no filesystem in mind.
 *
 * The ground truth is deliberately thin: `expectedRoute` and `critical`, and no
 * reason code. A reason code is a *mechanism's* output — the baseline cannot produce
 * `authority_mismatch` and should not be able to (dev/CHALLENGE.md §8). Pinning the
 * expectation to one would score a line against a design it does not have; pinning
 * it to the route scores it against what the operator actually gets.
 */
import type { Route } from './decision.ts';
import { isInstant, type InboundMessage } from './message.ts';
import type { Order, OrderStatus, SenderProfile } from './records.ts';

/** The four groups of dev/CHALLENGE.md §10, in its order. */
export const CASE_SUBSETS = ['normal', 'injection', 'authority', 'ambiguous'] as const;

export type CaseSubset = (typeof CASE_SUBSETS)[number];

const ROUTES: readonly Route[] = ['auto_send', 'human_review'];

const ORDER_STATUSES: readonly OrderStatus[] = [
  'placed',
  'shipped',
  'delivered',
  'refunded',
];

export interface EvaluationCase {
  readonly caseId: string;
  readonly subset: CaseSubset;
  /**
   * Ground truth: a message the operator genuinely had to reach. The numerator of
   * the primary metric, so it is spent sparingly — not every sensitive case is one.
   */
  readonly critical: boolean;
  /** Ground truth: where the message belongs. Never a reason code — see the header. */
  readonly expectedRoute: Route;
  readonly message: InboundMessage;
}

/**
 * The whole file. `senders` and `orders` are named to be handed straight to
 * `createRecordStore`, because the set and the record layer it refers to are one
 * thing: a case whose ownership facts live somewhere else is not a case.
 */
export interface CaseFile {
  readonly senders: readonly SenderProfile[];
  readonly orders: readonly Order[];
  readonly cases: readonly EvaluationCase[];
}

function fail(path: string, expected: string): never {
  throw new Error(`case file: ${path} ${expected}`);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

function asText(source: Record<string, unknown>, key: string, path: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${path}.${key}`, 'must be a non-empty string');
  }
  return value;
}

function asFlag(source: Record<string, unknown>, key: string, path: string): boolean {
  const value = source[key];
  if (typeof value !== 'boolean') fail(`${path}.${key}`, 'must be a boolean');
  return value;
}

function asMember<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  path: string,
): T {
  const value = source[key];
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) fail(`${path}.${key}`, `must be one of ${allowed.join(', ')}`);
  return match;
}

function parseSender(value: unknown, path: string): SenderProfile {
  const source = asRecord(value, path);
  return {
    senderId: asText(source, 'senderId', path),
    displayName: asText(source, 'displayName', path),
  };
}

function parseOrder(value: unknown, path: string): Order {
  const source = asRecord(value, path);
  return {
    orderId: asText(source, 'orderId', path),
    ownerSenderId: asText(source, 'ownerSenderId', path),
    status: asMember(source, 'status', ORDER_STATUSES, path),
  };
}

function parseMessage(value: unknown, path: string): InboundMessage {
  const source = asRecord(value, path);
  const receivedAt = asText(source, 'receivedAt', path);
  // The shape of an instant is `message.ts`'s rule, not this parser's: a scenario
  // arrival is the same instant, and one relaxed copy would be one relaxed rule.
  if (!isInstant(receivedAt)) {
    fail(`${path}.receivedAt`, 'must be an ISO timestamp carrying an explicit offset');
  }

  const envelope = {
    messageId: asText(source, 'messageId', path),
    senderId: asText(source, 'senderId', path),
    receivedAt,
    text: asText(source, 'text', path),
  };

  // Absent and present-but-empty are different mistakes: a thread summary is
  // optional, but an empty one would reach a prompt as a heading with nothing
  // under it.
  return 'threadSummary' in source
    ? { ...envelope, threadSummary: asText(source, 'threadSummary', path) }
    : envelope;
}

function parseCase(value: unknown, path: string): EvaluationCase {
  const source = asRecord(value, path);
  return {
    caseId: asText(source, 'caseId', path),
    subset: asMember(source, 'subset', CASE_SUBSETS, path),
    critical: asFlag(source, 'critical', path),
    expectedRoute: asMember(source, 'expectedRoute', ROUTES, path),
    message: parseMessage(source.message, `${path}.message`),
  };
}

/**
 * Validates decoded JSON and returns the set, or throws saying which field failed.
 *
 * Throwing rather than returning `null` is the opposite of how model output is
 * handled in `llm.ts`, and deliberately so: an unusable model response is an
 * expected outcome to route on, while an unusable evaluation file means the numbers
 * about to be printed are not the numbers anyone agreed to.
 */
export function parseCaseFile(value: unknown): CaseFile {
  const source = asRecord(value, 'root');

  return {
    senders: asArray(source.senders, 'senders').map((sender, index) =>
      parseSender(sender, `senders[${index}]`),
    ),
    orders: asArray(source.orders, 'orders').map((order, index) =>
      parseOrder(order, `orders[${index}]`),
    ),
    cases: asArray(source.cases, 'cases').map((entry, index) =>
      parseCase(entry, `cases[${index}]`),
    ),
  };
}
