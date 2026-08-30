/**
 * What a line is, and which lines exist. Anchored in dev/contracts/FEATURE-PARITY.md.
 *
 * A line receives the whole input — message, record layer, model client — and returns
 * one decision. Handing every line the record layer is deliberate: which parts of it
 * a line consults is a design choice, and that choice is exactly what the primary
 * metric measures.
 *
 * A line does not declare what it can do. The seven capabilities of dev/CHALLENGE.md §7
 * are read off the decisions it produces, in `src/__test__/contract/`; a name a line
 * carries about itself is a claim, and two lines carrying the same claim prove nothing
 * about either. What stays here is the shape everything else is written against.
 */
import type { LlmClient } from '../types/llm.ts';
import type { InboundMessage } from '../types/message.ts';
import type { RecordStore } from '../types/records.ts';
import { advanced } from './advanced/index.ts';
import { baseline } from './baseline/index.ts';
import type { Decision } from './decision.ts';

export interface PipelineInput {
  readonly message: InboundMessage;
  readonly records: RecordStore;
  readonly llm: LlmClient;
}

export interface Pipeline {
  readonly name: string;
  run(input: PipelineInput): Promise<Decision>;
}

export const PIPELINES: readonly Pipeline[] = [baseline, advanced];
