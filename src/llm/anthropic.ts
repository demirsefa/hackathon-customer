/**
 * The live client. Used to record `fixtures/llm-cache.json`, and behind `--live`.
 *
 * It takes the API key as an argument and never reads the environment. The one place
 * `ANTHROPIC_API_KEY` is touched is an entry point — `src/eval/` and `src/sim/` — so
 * there is exactly one line per program to audit, and no module
 * deeper in the tree can quietly acquire a credential. The key is never logged, never
 * put in an error message, and never written to the cache.
 *
 * Two model answers are refused rather than passed on: a policy refusal, and a
 * response with no text in it. Neither is a triage decision, and recording either as
 * an empty answer would bake a silent hole into a committed deliverable. A model
 * answer that *is* text but does not parse is a different thing entirely — that one
 * belongs to `core/`, which routes it to a human with `model_output_unusable`.
 *
 * A call that never reached an answer at all is named as its own type, for the reason
 * `ReplayMiss` is: a harness has to tell "this environment cannot make the call" from
 * "this line has a bug". Without it a rejected key ended a run with thirty lines of
 * SDK stack trace and an absolute path out of somebody's home directory, on a project
 * whose own rule is that a judge should read what to do next.
 */
import Anthropic from '@anthropic-ai/sdk';

import type { LlmClient, LlmRequest, LlmResponse } from '../types/llm.ts';
import { PINNED_PARAMS, type LlmParams } from './key.ts';

/**
 * A live call that never reached an answer: a rejected key, a rate limit, no network.
 * A fact about the environment rather than about a decision, so an entry point can
 * report it as one line the way it reports a missing key.
 */
export class LiveCallFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveCallFailed';
  }
}

export function isLiveCallFailed(error: unknown): error is LiveCallFailed {
  return error instanceof LiveCallFailed;
}

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

  /** The request itself, with everything that can go wrong on the way named once. */
  async function ask(prompt: string): Promise<Anthropic.Message> {
    try {
      return await client.messages.create({
        model: params.model,
        max_tokens: params.maxTokens,
        // Adaptive thinking is on by default on this model and is left on: the
        // parameters that are pinned are the ones written down, and an unstated
        // opt-out is exactly the kind of drift `PINNED_PARAMS` exists to stop.
        output_config: { effort: params.effort },
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (error) {
      throw new LiveCallFailed(
        [
          `${params.model}: the live call failed — ${
            error instanceof Error ? error.message : String(error)
          }`,
          '  Check ANTHROPIC_API_KEY, or drop --live to replay the committed cache,',
          '  which calls nothing and needs no key.',
        ].join('\n'),
      );
    }
  }

  return {
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const response = await ask(request.prompt);

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
