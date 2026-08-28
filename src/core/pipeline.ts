/**
 * What a line is, and which lines exist. Anchored in dev/contracts/FEATURE-PARITY.md.
 *
 * A line receives the whole input — message, record layer, model client — and returns
 * one decision. Handing every line the record layer is deliberate: which parts of it
 * a line consults is a design choice, and that choice is exactly what the primary
 * metric measures.
 */
import { baseline } from './baseline/index.ts';
import type { Decision } from './decision.ts';
import type { LlmClient } from './llm.ts';
import type { InboundMessage } from './message.ts';
import type { RecordStore } from './records.ts';

/**
 * The feature set every line must expose. The measured difference between two lines
 * is only meaningful if this list is satisfied on both sides.
 */
export const REQUIRED_FEATURES = [
  'authority-gate-before-model',
  'unresolved-reference-held',
  'draft-policy-validation',
  'sensitive-category-hold',
  'confidence-threshold',
  'human-approval-gate',
  'reason-code-on-every-decision',
] as const;

export type Feature = (typeof REQUIRED_FEATURES)[number];

export type PipelineInput = {
  readonly message: InboundMessage;
  readonly records: RecordStore;
  readonly llm: LlmClient;
};

export type Pipeline = {
  readonly name: string;
  /**
   * Declared per implementation rather than shared, so a capability that lands on one
   * side has to be claimed on the other before the parity check passes.
   */
  readonly features: readonly Feature[];
  run(input: PipelineInput): Promise<Decision>;
};

export const PIPELINES: readonly Pipeline[] = [baseline];
