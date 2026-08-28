/**
 * The two implementations, side by side. Anchored in dev/contracts/FEATURE-PARITY.md.
 *
 * They are in one file so that adding a capability to one and not the other shows up
 * in a single diff. The baseline is not a strawman: it runs the same gate, the same
 * draft policy and the same thresholds. What differs is the internal design — one
 * pass against three, and whether the model gets a second look at its own draft.
 */
import { gateOnAuthority, permittedOrderIds, resolveAuthority } from './authority.ts';
import { humanReview, type Decision } from './decision.ts';
import {
  buildClassifyPrompt,
  buildDraftPrompt,
  buildTriagePrompt,
  buildVerifyPrompt,
  parseClassifyOutput,
  parseDraftOutput,
  parseTriageOutput,
  parseVerifyOutput,
  type LlmClient,
} from './llm.ts';
import type { InboundMessage } from './message.ts';
import { finalize } from './policy.ts';
import type { RecordStore } from './records.ts';

/**
 * The feature set both implementations must expose. The measured difference between
 * them is only meaningful if this list is satisfied on both sides.
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

export const baseline: Pipeline = {
  name: 'baseline',
  features: [
    'authority-gate-before-model',
    'unresolved-reference-held',
    'draft-policy-validation',
    'sensitive-category-hold',
    'confidence-threshold',
    'human-approval-gate',
    'reason-code-on-every-decision',
  ],

  async run({ message, records, llm }): Promise<Decision> {
    const outcome = resolveAuthority(message, records);
    const held = gateOnAuthority(message.messageId, outcome);
    if (held !== null) return held;

    const response = await llm.complete({
      prompt: buildTriagePrompt(message.text, message.threadSummary),
    });
    const output = parseTriageOutput(response.text);
    if (output === null) {
      return humanReview({
        messageId: message.messageId,
        reason: 'model_output_unusable',
        llmCalls: 1,
      });
    }

    return finalize({
      messageId: message.messageId,
      category: output.category,
      confidence: output.confidence,
      draft: output.draft,
      permittedOrderIds: permittedOrderIds(outcome),
      llmCalls: 1,
    });
  },
};

export const advanced: Pipeline = {
  name: 'advanced',
  features: [
    'authority-gate-before-model',
    'unresolved-reference-held',
    'draft-policy-validation',
    'sensitive-category-hold',
    'confidence-threshold',
    'human-approval-gate',
    'reason-code-on-every-decision',
  ],

  async run({ message, records, llm }): Promise<Decision> {
    const outcome = resolveAuthority(message, records);
    const held = gateOnAuthority(message.messageId, outcome);
    if (held !== null) return held;

    const messageId = message.messageId;
    const unusable = (llmCalls: number): Decision =>
      humanReview({ messageId, reason: 'model_output_unusable', llmCalls });

    const classified = parseClassifyOutput(
      (
        await llm.complete({
          prompt: buildClassifyPrompt(message.text, message.threadSummary),
        })
      ).text,
    );
    if (classified === null) return unusable(1);

    const draft = parseDraftOutput(
      (
        await llm.complete({
          prompt: buildDraftPrompt(message.text, message.threadSummary),
        })
      ).text,
    );
    if (draft === null) return unusable(2);

    const verified = parseVerifyOutput(
      (await llm.complete({ prompt: buildVerifyPrompt(draft) })).text,
    );
    if (verified === null) return unusable(3);

    // A rejected draft is not a low-confidence draft with a better excuse: it drops
    // to zero so it lands in the same place, held, with the same reason code.
    const confidence = verified.ok
      ? Math.min(classified.confidence, verified.confidence)
      : 0;

    return finalize({
      messageId,
      category: classified.category,
      confidence,
      draft,
      permittedOrderIds: permittedOrderIds(outcome),
      llmCalls: 3,
    });
  },
};

export const PIPELINES: readonly Pipeline[] = [baseline, advanced];
