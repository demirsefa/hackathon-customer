/**
 * Fakes shared by the checks in this folder.
 *
 * Two of them matter: `refusingLlm` makes "no model call was needed" observable by
 * failing loudly if one happens, and `agreeingScript` lets one script drive both
 * pipelines, so a parity check compares implementations rather than scripts.
 */
import type { LlmClient, LlmRequest } from '../core/llm.ts';

/**
 * Painted text back as plain text, for the two log checks.
 *
 * Both make the same assertion: the colour is decoration, so taking it off gives back
 * the block the plain painter produced, column for column.
 *
 * It cuts the sequences out rather than matching them, because a control character in a
 * regular expression is a lint error — and a fair one, since nobody can see it in a
 * diff. Every sequence `src/cli/paint.ts` writes is `ESC[…m`, so everything up to and
 * including the first `m` after an escape is the part that is not text.
 */
const ESCAPE = '\u001b';

export const stripColour = (text: string): string =>
  text
    .split(ESCAPE)
    .map((part, index) => (index === 0 ? part : part.slice(part.indexOf('m') + 1)))
    .join('');

export type TaskName = 'triage' | 'classify' | 'draft';

const TASKS: readonly TaskName[] = ['triage', 'classify', 'draft'];

function readTask(prompt: string): TaskName {
  const [header] = prompt.split('\n');
  const name =
    header?.startsWith('TASK: ') === true ? header.slice('TASK: '.length).trim() : '';

  const task = TASKS.find((candidate) => candidate === name);
  if (task === undefined) {
    throw new Error(`prompt has no recognisable task header: ${JSON.stringify(header)}`);
  }
  return task;
}

export interface RecordingLlm extends LlmClient {
  readonly prompts: readonly string[];
  readonly calls: number;
}

export function scriptedLlm(script: Partial<Record<TaskName, string>>): RecordingLlm {
  const prompts: string[] = [];

  return {
    prompts,
    get calls(): number {
      return prompts.length;
    },
    complete(request: LlmRequest): Promise<{ text: string }> {
      prompts.push(request.prompt);
      const task = readTask(request.prompt);
      const reply = script[task];
      if (reply === undefined) {
        throw new Error(`no scripted reply for task "${task}"`);
      }
      return Promise.resolve({ text: reply });
    },
  };
}

/** Fails the moment it is called, which is how a "zero model calls" claim is proven. */
export function refusingLlm(): RecordingLlm {
  const prompts: string[] = [];

  return {
    prompts,
    get calls(): number {
      return prompts.length;
    },
    complete(request: LlmRequest): Promise<{ text: string }> {
      prompts.push(request.prompt);
      throw new Error('the model was called on a decision that must not need one');
    },
  };
}

/**
 * One model opinion, expressed in every shape any line asks for, so the only
 * difference left between two lines is their own design.
 *
 * The two scores are not the same thing and are not derived from each other:
 * `urgency` is what the baseline asks for — how loud the message sounds, on the
 * 0-100 scale a decision's priority uses — and `confidence` is the model's own
 * certainty, which only the advanced line has a use for.
 *
 * The two flags are questions only the advanced classification pass asks, so they
 * default to the answer that lets a message through: a fake that held everything
 * would make its line look careful without the line having decided anything.
 */
export function agreeingScript(input: {
  readonly category: string;
  readonly urgency: number;
  readonly confidence: number;
  readonly draft: string;
  /** Whether the text is aimed at the system rather than at the desk. */
  readonly instruction?: boolean;
  /** Whether answering would mean reading the sender's own records. */
  readonly needsRecord?: boolean;
}): Record<TaskName, string> {
  const { category, urgency, confidence, draft } = input;
  const instruction = input.instruction ?? false;
  const needsRecord = input.needsRecord ?? false;

  return {
    triage: JSON.stringify({ category, urgency, draft }),
    classify: JSON.stringify({ category, confidence, instruction, needsRecord }),
    draft: JSON.stringify({ draft }),
  };
}
