/**
 * The baseline's single pass: category, confidence and a draft asked for at once.
 *
 * Asking for all three together is the design being measured, not an oversight — it
 * is what a reasonable person builds first, and it is why the model can bend the
 * category to fit the draft it already wants to write.
 */
import { parseObject, readConfidence, readString, withThread } from '../llm.ts';

const FORMAT_TRIAGE =
  'Reply with JSON only: {"category": string, "confidence": number 0-1, "draft": string}';

export function buildTriagePrompt(text: string, threadSummary?: string): string {
  return `TASK: triage\n${FORMAT_TRIAGE}\n\n${withThread(text, threadSummary)}`;
}

export type TriageOutput = {
  readonly category: string;
  readonly confidence: number;
  readonly draft: string;
};

export function parseTriageOutput(raw: string): TriageOutput | null {
  const parsed = parseObject(raw);
  if (parsed === null) return null;

  const category = readString(parsed, 'category');
  const draft = readString(parsed, 'draft');
  const confidence = readConfidence(parsed);
  if (category === null || draft === null || confidence === null) return null;

  return { category, confidence, draft };
}
