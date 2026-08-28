/**
 * Advanced's classification pass. Separate from the draft on purpose: a model asked
 * for a category and a reply in one breath will pick the category that suits the
 * reply.
 */
import { parseObject, readConfidence, readString, withThread } from '../llm.ts';

const FORMAT_CLASSIFY =
  'Reply with JSON only: {"category": string, "confidence": number 0-1}';

export function buildClassifyPrompt(text: string, threadSummary?: string): string {
  return `TASK: classify\n${FORMAT_CLASSIFY}\n\n${withThread(text, threadSummary)}`;
}

export type ClassifyOutput = {
  readonly category: string;
  readonly confidence: number;
};

export function parseClassifyOutput(raw: string): ClassifyOutput | null {
  const parsed = parseObject(raw);
  if (parsed === null) return null;

  const category = readString(parsed, 'category');
  const confidence = readConfidence(parsed);
  if (category === null || confidence === null) return null;

  return { category, confidence };
}
