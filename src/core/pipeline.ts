/**
 * What a line is, and which lines exist. Anchored in dev/contracts/FEATURE-PARITY.md.
 *
 * A line receives the whole input — message, record layer, model client — and returns
 * one decision. Handing every line the record layer is deliberate: which parts of it
 * a line consults is a design choice, and that choice is exactly what the primary
 * metric measures.
 */
import type { LlmClient } from '../types/llm.ts';
import type { InboundMessage } from '../types/message.ts';
import type { RecordStore } from '../types/records.ts';
import { advanced } from './advanced/index.ts';
import { baseline } from './baseline/index.ts';
import type { Decision } from './decision.ts';

/**
 * The feature set every line must expose — the seven capabilities of
 * dev/CHALLENGE.md §7, in its order.
 *
 * These are **features**: what the operator gets. They are deliberately not
 * mechanisms — a record-backed authority gate, a separate classification pass, a
 * confidence threshold are ways of reaching a feature, and demanding them of every
 * line would make the two lines identical by contract. The measured difference is
 * exactly the mechanism each line chooses; parity belongs one level above it.
 */
export const REQUIRED_FEATURES = [
  'assigns-category',
  'assigns-urgency',
  'produces-draft',
  'risky-never-auto-sent',
  'queued-case-carries-reason',
  'interim-message-on-threshold',
  'reason-code-on-every-decision',
] as const;

export type Feature = (typeof REQUIRED_FEATURES)[number];

export interface PipelineInput {
  readonly message: InboundMessage;
  readonly records: RecordStore;
  readonly llm: LlmClient;
}

export interface Pipeline {
  readonly name: string;
  /**
   * Declared per implementation rather than shared, so a capability that lands on one
   * side has to be claimed on the other before the parity check passes.
   */
  readonly features: readonly Feature[];
  run(input: PipelineInput): Promise<Decision>;
}

export const PIPELINES: readonly Pipeline[] = [baseline, advanced];
