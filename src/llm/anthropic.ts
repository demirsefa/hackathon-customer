/**
 * The live client. Used to record `fixtures/llm-cache.json`, and behind `--live`.
 *
 * It takes the API key as an argument and never reads the environment. The one place
 * `ANTHROPIC_API_KEY` is touched is an entry point — `src/eval/`, `src/sim/`,
 * `src/service/` — so there is exactly one line per program to audit, and no module
 * deeper in the tree can quietly acquire a credential. The key is never logged, never
 * put in an error message, and never written to the cache.
 *
 * Two model answers are refused rather than passed on: a policy refusal, and a
 * response with no text in it. Neither is a triage decision, and recording either as
 * an empty answer would bake a silent hole into a committed deliverable. A model
 * answer that *is* text but does not parse is a different thing entirely — that one
 * belongs to `core/`, which routes it to a human with `model_output_unusable`.
 */
import Anthropic from '@anthropic-ai/sdk';

import type { LlmClient, LlmRequest, LlmResponse } from '../core/llm.ts';
import { PINNED_PARAMS, type LlmParams } from './key.ts';

export function anthropicClient(input: {
  /** Read at the entry point from the environment, and only there. */
  readonly apiKey: string;
  readonly params?: LlmParams;
}): LlmClient {
  if (input.apiKey.length === 0) {
    // Passing an empty key would let the SDK fall back to the environment on its own,
    // which is the one thing this argument exists to prevent.
    throw new Error('anthropicClient: an API key is required for a live call.');
  }

  const params = input.params ?? PINNED_PARAMS;
  const client = new Anthropic({ apiKey: input.apiKey });

  return {
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const response = await client.messages.create({
        model: params.model,
        max_tokens: params.maxTokens,
        // Adaptive thinking is on by default on this model and is left on: the
        // parameters that are pinned are the ones written down, and an unstated
        // opt-out is exactly the kind of drift `PINNED_PARAMS` exists to stop.
        output_config: { effort: params.effort },
        messages: [{ role: 'user', content: request.prompt }],
      });

      if (response.stop_reason === 'refusal') {
        const category = response.stop_details?.category ?? 'unspecified';
        throw new Error(`${params.model} refused this request (category: ${category}).`);
      }

      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');

      if (text.length === 0) {
        throw new Error(
          `${params.model} returned no text (stop_reason: ${response.stop_reason}).`,
        );
      }

      return { text };
    },
  };
}
