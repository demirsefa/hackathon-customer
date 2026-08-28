/**
 * Advanced's drafting pass, reached only by messages the gate already let through.
 */
import { parseObject, readString, withThread } from '../llm.ts';

const FORMAT_DRAFT = 'Reply with JSON only: {"draft": string}';

export function buildDraftPrompt(text: string, threadSummary?: string): string {
  return `TASK: draft\n${FORMAT_DRAFT}\n\n${withThread(text, threadSummary)}`;
}

export function parseDraftOutput(raw: string): string | null {
  const parsed = parseObject(raw);
  return parsed === null ? null : readString(parsed, 'draft');
}
