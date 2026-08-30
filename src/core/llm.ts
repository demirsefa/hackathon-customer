/**
 * The primitives every prompt file builds a request with and parses its response
 * with.
 *
 * The client interface itself is declared in `types/llm.ts`; the prompts live next to
 * the line that spends them — `baseline/` and `advanced/` — because a prompt is part
 * of a design, not a shared utility. What stays here is the other half of what both
 * lines must not diverge on: how a prompt is assembled out of untrusted material —
 * and out of nothing else, for the reason `types/llm.ts` gives — and how an untrusted
 * response is read back.
 */

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

/**
 * A model asked for JSON often returns it inside a markdown code fence — ```` ```json ````
 * on the first line and ```` ``` ```` on the last. The payload is exactly what was asked
 * for; the fence is presentation wrapped around it.
 *
 * That is a formatting habit, not a malformed answer, so it is removed before parsing
 * rather than routed as unusable. The distinction is the whole point of the function:
 * an answer that arrived in the requested shape must be read, and an answer that did
 * not must not be guessed at. Prose around the JSON is therefore left alone — a model
 * that explained itself instead of answering did not follow the instruction, and
 * digging a object out of the sentence would be exactly the guessing this boundary
 * exists to refuse.
 *
 * Found the hard way. A steady fraction of the responses recorded in
 * `fixtures/llm-cache.json` arrive fenced, every one of them carrying valid JSON, and
 * every one of them was being discarded — which sent correctly-classified messages to
 * the operator under `model_output_unusable` and inflated the coverage number the
 * submission is scored on.
 */
function stripFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('```')) return trimmed;

  return trimmed
    .replace(/^```[^\n]*\n/, '')
    .replace(/\n?```$/, '')
    .trim();
}

export function parseObject(raw: string): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(raw));
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
