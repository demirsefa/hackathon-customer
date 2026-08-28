/**
 * The baseline's single pass: category, urgency and a draft asked for at once.
 *
 * Asking for all three together is the design being measured, not an oversight — it
 * is what a reasonable person builds first, and it is why the model can bend the
 * category to fit the draft it already wants to write.
 *
 * There is no confidence field, and that absence is the point: the baseline has no
 * concept of uncertainty (dev/CHALLENGE.md §8). Urgency is not one — it is how loud
 * the message sounds, which is a claim about the customer, not about the model.
 */
import { parseObject, readString, withThread } from '../llm.ts';

const FORMAT_TRIAGE =
  'Reply with JSON only: {"category": string, "urgency": number 0-100, "draft": string}';

export function buildTriagePrompt(text: string, threadSummary?: string): string {
  return `TASK: triage\n${FORMAT_TRIAGE}\n\n${withThread(text, threadSummary)}`;
}

export type TriageOutput = {
  readonly category: string;
  /** The model's own read-first score, on the same 0-100 scale a decision carries. */
  readonly urgency: number;
  readonly draft: string;
};

function readUrgency(source: Record<string, unknown>): number | null {
  const value = source.urgency;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

export function parseTriageOutput(raw: string): TriageOutput | null {
  const parsed = parseObject(raw);
  if (parsed === null) return null;

  const category = readString(parsed, 'category');
  const draft = readString(parsed, 'draft');
  const urgency = readUrgency(parsed);
  if (category === null || draft === null || urgency === null) return null;

  return { category, urgency, draft };
}
