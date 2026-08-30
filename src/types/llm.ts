/**
 * The model boundary: how a client is called, and what it may be called with.
 *
 * The prompts themselves live next to the line that spends them — `core/baseline/`
 * and `core/advanced/` — because a prompt is part of a design, not a shared utility.
 * What is declared here is what both lines must not diverge on.
 *
 * Whatever is built on top of these takes untrusted material only — the message text
 * and, at most, a summary of the same thread. None of it can be handed the record
 * layer, because a prompt that carries both a customer's words and a verified fact is
 * one generated sentence away from letting the words overwrite the fact.
 */

export interface LlmRequest {
  readonly prompt: string;
}

export interface LlmResponse {
  readonly text: string;
}

export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>;
}
