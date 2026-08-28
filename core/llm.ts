/**
 * The model boundary: the client interface, the prompts, and the parsing of what
 * comes back.
 *
 * Every prompt builder here takes untrusted material only — the message text and, at
 * most, a summary of the same thread. None of them can be handed the record layer,
 * because a prompt that carries both a customer's words and a verified fact is one
 * generated sentence away from letting the words overwrite the fact.
 */

export type LlmRequest = { readonly prompt: string };
export type LlmResponse = { readonly text: string };

export type LlmClient = {
  complete(request: LlmRequest): Promise<LlmResponse>;
};

const FORMAT_TRIAGE =
  'Reply with JSON only: {"category": string, "confidence": number 0-1, "draft": string}';
const FORMAT_CLASSIFY =
  'Reply with JSON only: {"category": string, "confidence": number 0-1}';
const FORMAT_DRAFT = 'Reply with JSON only: {"draft": string}';
const FORMAT_VERIFY = 'Reply with JSON only: {"ok": boolean, "confidence": number 0-1}';

function withThread(text: string, threadSummary: string | undefined): string {
  // The summary is labelled as reported, not established: it is model-written text
  // about untrusted messages, and it never gains authority by being summarised.
  return threadSummary === undefined
    ? `MESSAGE:\n${text}`
    : `EARLIER IN THIS THREAD (reported by the sender, unverified):\n${threadSummary}\n\nMESSAGE:\n${text}`;
}

/** Baseline's single pass: category, confidence and a draft in one call. */
export function buildTriagePrompt(text: string, threadSummary?: string): string {
  return `TASK: triage\n${FORMAT_TRIAGE}\n\n${withThread(text, threadSummary)}`;
}

export function buildClassifyPrompt(text: string, threadSummary?: string): string {
  return `TASK: classify\n${FORMAT_CLASSIFY}\n\n${withThread(text, threadSummary)}`;
}

export function buildDraftPrompt(text: string, threadSummary?: string): string {
  return `TASK: draft\n${FORMAT_DRAFT}\n\n${withThread(text, threadSummary)}`;
}

/** Advanced's second opinion on its own draft. */
export function buildVerifyPrompt(draft: string): string {
  return `TASK: verify\n${FORMAT_VERIFY}\n\nDRAFT:\n${draft}`;
}

export type TriageOutput = {
  readonly category: string;
  readonly confidence: number;
  readonly draft: string;
};

export type ClassifyOutput = {
  readonly category: string;
  readonly confidence: number;
};

export type VerifyOutput = {
  readonly ok: boolean;
  readonly confidence: number;
};

/**
 * Model output is an external boundary, so it is parsed rather than assumed. A
 * response that does not fit returns `null` and the caller routes the message to a
 * human — an unusable answer is a reason to stop, not a reason to guess.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseObject(raw: string): Record<string, unknown> | null {
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

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readConfidence(source: Record<string, unknown>): number | null {
  const value = source.confidence;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}

export function parseTriageOutput(raw: string): TriageOutput | null {
  const parsed = parseObject(raw);
  if (parsed === null) return null;

  const category = readString(parsed, 'category');
  const draft = readString(parsed, 'draft');
  const confidence = readConfidence(parsed);
  if (category === null || draft === null || confidence === null) return null;

  return { category, confidence, draft };
}

export function parseClassifyOutput(raw: string): ClassifyOutput | null {
  const parsed = parseObject(raw);
  if (parsed === null) return null;

  const category = readString(parsed, 'category');
  const confidence = readConfidence(parsed);
  if (category === null || confidence === null) return null;

  return { category, confidence };
}

export function parseDraftOutput(raw: string): string | null {
  const parsed = parseObject(raw);
  return parsed === null ? null : readString(parsed, 'draft');
}

export function parseVerifyOutput(raw: string): VerifyOutput | null {
  const parsed = parseObject(raw);
  if (parsed === null) return null;

  const ok = parsed.ok;
  const confidence = readConfidence(parsed);
  if (typeof ok !== 'boolean' || confidence === null) return null;

  return { ok, confidence };
}
