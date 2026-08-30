/**
 * A scenario as a value: when each message lands in the inbox, and whose desk it
 * lands on.
 *
 * What arrives is not stated here: an arrival names a case, and the text of that case
 * comes from the evaluation set. Validating one of these files, and joining it to the
 * cases it names, is `core/scenario.ts`.
 */
import type { OperatorConfig } from './operator.ts';

/** One message landing in the inbox at a stated instant. */
export interface Arrival {
  readonly messageId: string;
  /** Which case from `fixtures/cases.json` arrived. Many arrivals may name one case. */
  readonly caseId: string;
  /** ISO, with an explicit offset — `core/message.ts` owns the rule. */
  readonly at: string;
}

export interface Scenario {
  readonly name: string;
  /**
   * Exactly one. The field is an array because the file writes it as one and a desk
   * with two people is a plausible thing to want later; the player refuses more than
   * one rather than quietly averaging two calendars into a number nobody agreed to.
   */
  readonly operator: OperatorConfig;
  /** Sorted by arrival, then by message id. Guaranteed by the parser. */
  readonly arrivals: readonly Arrival[];
}
