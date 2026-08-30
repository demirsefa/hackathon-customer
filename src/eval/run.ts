/**
 * Drives every line over the same case list, and keeps a record of what each one did.
 *
 * One message in, one decision out, in file order, one line at a time. Nothing here
 * scores anything and nothing here writes a file: this produces the material that
 * `score.ts` measures and `trajectory.ts` renders, which is what keeps both of those
 * pure enough to test without a case file or a model.
 *
 * Every line receives the same record store, built once from the same file the cases
 * came from — dev/contracts/FEATURE-PARITY.md rule 4 asks that the lines be measured
 * on the same cases, and the way to honour that is to have only one place they could
 * come from.
 *
 * The message text and the record layer both reach a line through a thin observer, so
 * a trajectory can say what the line actually asked for rather than what its design
 * says it asks for. That distinction is the whole deliverable: "the baseline never
 * opened the record layer" is worth nothing as a claim and everything as a step list
 * with no lookups in it.
 */
import type { CaseFile, CaseSubset } from '../core/cases.ts';
import type { Decision, Route } from '../core/decision.ts';
import type { Pipeline } from '../core/pipeline.ts';
import { createRecordStore } from '../core/records.ts';
import { CACHE_LABEL, isReplayMiss } from '../llm/replay.ts';
import type { LlmClient } from '../types/llm.ts';
import type { InboundMessage } from '../types/message.ts';
import type { RecordStore } from '../types/records.ts';

/**
 * One thing the line reached for while deciding. Both kinds are kept in a single
 * ordered list, because the order is the interesting part — a record lookup before
 * the model call is a different design from one after it.
 */
export type Step =
  | { readonly kind: 'llm'; readonly prompt: string; readonly response: string }
  | {
      readonly kind: 'record';
      readonly lookup: string;
      /** What the record layer held, or `null` when it held nothing. */
      readonly found: string | null;
    };

export interface CaseRun {
  readonly caseId: string;
  readonly subset: CaseSubset;
  readonly critical: boolean;
  readonly expectedRoute: Route;
  readonly message: InboundMessage;
  readonly decision: Decision;
  readonly steps: readonly Step[];
}

export interface PipelineRun {
  readonly pipeline: string;
  readonly runs: readonly CaseRun[];
  /**
   * Cases whose model responses are not in the replay cache. Collected rather than
   * thrown, so one run can say how much of the cache is missing instead of stopping
   * at the first gap and being re-run once per case.
   */
  readonly unrecorded: readonly string[];
}

function observeLlm(llm: LlmClient, steps: Step[]): LlmClient {
  return {
    async complete(request) {
      const response = await llm.complete(request);
      // Pushed after the answer arrives: a call that failed produced no exchange, and
      // a half-written step in a trajectory would read as an answer that never came.
      steps.push({ kind: 'llm', prompt: request.prompt, response: response.text });
      return response;
    },
  };
}

function observeRecords(records: RecordStore, steps: Step[]): RecordStore {
  return {
    findOrder(orderId) {
      const order = records.findOrder(orderId);
      steps.push({
        kind: 'record',
        lookup: `findOrder(${JSON.stringify(orderId)})`,
        found:
          order === undefined
            ? null
            : `${order.orderId}, owned by ${order.ownerSenderId}, status ${order.status}`,
      });
      return order;
    },
    findSender(senderId) {
      const sender = records.findSender(senderId);
      steps.push({
        kind: 'record',
        lookup: `findSender(${JSON.stringify(senderId)})`,
        found: sender === undefined ? null : `${sender.senderId}, ${sender.displayName}`,
      });
      return sender;
    },
  };
}

/**
 * One case, the moment it is over. Handed out rather than printed: this file decides
 * nothing about a terminal, and the entry point that owns stderr does.
 */
export interface CaseProgress {
  /** 1-based, so it reads as "7 of 28" rather than as an index into an array. */
  readonly done: number;
  readonly total: number;
  readonly caseId: string;
  /** What the case cost, or `null` when the cache could not answer it. */
  readonly llmCalls: number | null;
}

export async function runPipeline(input: {
  readonly pipeline: Pipeline;
  readonly caseFile: CaseFile;
  readonly llm: LlmClient;
  /**
   * Called once per case, in order, whether it decided or missed. A live run uses it
   * to say the run is still moving and to write down what it has already paid for.
   */
  readonly onCase?: (progress: CaseProgress) => void;
}): Promise<PipelineRun> {
  const records = createRecordStore(input.caseFile);
  const runs: CaseRun[] = [];
  const unrecorded: string[] = [];

  // Sequential and in file order, because dev/CHALLENGE.md §10 requires messages to
  // be processed one at a time: a batch lets a model find a contradiction by
  // comparison, which is an advantage it will never have in production.
  const total = input.caseFile.cases.length;
  let done = 0;

  for (const evaluationCase of input.caseFile.cases) {
    const steps: Step[] = [];
    let cost: number | null = null;

    try {
      const decision = await input.pipeline.run({
        message: evaluationCase.message,
        records: observeRecords(records, steps),
        llm: observeLlm(input.llm, steps),
      });

      cost = decision.llmCalls;

      runs.push({
        caseId: evaluationCase.caseId,
        subset: evaluationCase.subset,
        critical: evaluationCase.critical,
        expectedRoute: evaluationCase.expectedRoute,
        message: evaluationCase.message,
        decision,
        steps,
      });
    } catch (error) {
      // Only a replay miss is an expected outcome here. Anything else is a defect in
      // a line, and swallowing it would report a broken pipeline as a missing
      // recording — which sends the next person to re-record a cache that is fine.
      if (!isReplayMiss(error)) throw error;
      unrecorded.push(evaluationCase.caseId);
    }

    done += 1;
    input.onCase?.({ done, total, caseId: evaluationCase.caseId, llmCalls: cost });
  }

  return { pipeline: input.pipeline.name, runs, unrecorded };
}

/**
 * What a run says instead of a stack trace when the cache cannot answer it.
 *
 * `yarn eval` is the first command a judge runs and the one that must work with no
 * credentials, so an incomplete cache has to read as a one-line instruction rather
 * than as a failure of the project. Nothing is scored and nothing is written in this
 * state: a partial table is a number nobody agreed to, and it would be quoted.
 */
export function unrecordedNotice(input: {
  readonly unrecorded: readonly string[];
  readonly total: number;
}): string {
  const missing = input.unrecorded.length;
  const all = missing === input.total;

  return [
    `eval: ${String(missing)} of ${String(input.total)} case(s) have no recorded ` +
      `model response in ${CACHE_LABEL}.`,
    all
      ? '  The cache is empty, so nothing was scored.'
      : `  Not scored: ${input.unrecorded.join(', ')}`,
    `  Fix it once: run \`yarn eval --live\` with ANTHROPIC_API_KEY set, then commit ${CACHE_LABEL}.`,
  ].join('\n');
}
