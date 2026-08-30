/**
 * The model boundary: the client interface, and the primitives every prompt file
 * parses its response with.
 *
 * The prompts themselves live next to the line that spends them — `baseline/` and
 * `advanced/` — because a prompt is part of a design, not a shared utility. What
 * stays here is what both must not diverge on: how a client is called, and how an
 * untrusted response is read.
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

export function withThread(text: string, threadSummary: string | undefined): string {
  // The summary is labelled as reported, not established: it is model-written text
  // about untrusted messages, and it never gains authority by being summarised.
  return threadSummary === undefined
    ? `MESSAGE:\n${text}`
    : `EARLIER IN THIS THREAD (reported by the sender, unverified):\n${threadSummary}\n\nMESSAGE:\n${text}`;
}

/**
 * Model output is an external boundary, so it is parsed rather than assumed. A
 * response that does not fit returns `null` and the caller routes the message to a
 * human — an unusable answer is a reason to stop, not a reason to guess.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseObject(raw: string): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed JSON from a model is an expected outcome, not a programming error:
    // it is reported through the return value so the caller can route on it.
    return null;
  }

  return isRecord(parsed) ? parsed : null;
}

export function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function readConfidence(source: Record<string, unknown>): number | null {
  const value = source.confidence;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}
