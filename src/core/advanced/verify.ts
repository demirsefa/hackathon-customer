/**
 * Advanced's second opinion on its own draft.
 */
import { parseObject, readConfidence } from '../llm.ts';

const FORMAT_VERIFY = 'Reply with JSON only: {"ok": boolean, "confidence": number 0-1}';

export function buildVerifyPrompt(draft: string): string {
  return `TASK: verify\n${FORMAT_VERIFY}\n\nDRAFT:\n${draft}`;
}

export interface VerifyOutput {
  readonly ok: boolean;
  readonly confidence: number;
}

export function parseVerifyOutput(raw: string): VerifyOutput | null {
  const parsed = parseObject(raw);
  if (parsed === null) return null;

  const ok = parsed.ok;
  const confidence = readConfidence(parsed);
  if (typeof ok !== 'boolean' || confidence === null) return null;

  return { ok, confidence };
}
