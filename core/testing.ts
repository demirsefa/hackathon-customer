/**
 * Fakes for the contract checks in this folder.
 *
 * Two of them matter: `refusingLlm` makes "no model call was needed" observable by
 * failing loudly if one happens, and `agreeingScript` lets one script drive both
 * pipelines, so a parity check compares implementations rather than scripts.
 */
import type { LlmClient, LlmRequest } from './llm.ts';

export type TaskName = 'triage' | 'classify' | 'draft' | 'verify';

const TASKS: readonly TaskName[] = ['triage', 'classify', 'draft', 'verify'];

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

export type RecordingLlm = LlmClient & {
  readonly prompts: readonly string[];
  readonly calls: number;
};

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
 * One model opinion, expressed in every shape both pipelines ask for, so the only
 * difference left between them is their own design.
 */
export function agreeingScript(input: {
  readonly category: string;
  readonly confidence: number;
  readonly draft: string;
}): Record<TaskName, string> {
  const { category, confidence, draft } = input;

  return {
    triage: JSON.stringify({ category, confidence, draft }),
    classify: JSON.stringify({ category, confidence }),
    draft: JSON.stringify({ draft }),
    verify: JSON.stringify({ ok: true, confidence }),
  };
}
