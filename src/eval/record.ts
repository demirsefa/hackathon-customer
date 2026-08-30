/**
 * The run as data — `trajectories/<line>.json`, the raw half of deliverable 4.
 *
 * `trajectory.ts` renders prose a person reads. This file is what that prose is a
 * view of: every case, every step, every decision and the scorecard, in the shape the
 * program actually held them in. A reader who does not trust a rendered document can
 * recompute the numbers from this one, and a reader who wants a different cut can
 * write ten lines of `jq` instead of parsing markdown.
 *
 * The two are not written independently. The entry point serialises this record,
 * parses the serialised text back, and renders the markdown **from the parsed value** —
 * so the document cannot carry a fact the JSON lacks. That is the property
 * `src/__test__/unit/eval-record.test.ts` asserts, and it is why the markdown may be
 * regenerated from the JSON at any time without a model, a cache or a network.
 *
 * Not to be confused with `src/llm/record.ts`, which is a client that records model
 * answers. This one records a run.
 *
 * There is no timestamp in it, for the reason `trajectory.ts` gives: a replayed run is
 * a function of the commit and the committed cache, both named in `provenance`, so a
 * clock would add diff noise without adding anything a reader could reproduce from.
 */
import type { LlmParams } from '../llm/key.ts';
import { CACHE_LABEL } from '../llm/replay.ts';
import type { PipelineRun } from './run.ts';
import type { Scorecard } from './score.ts';

/**
 * Versioned, and stated in the file rather than inferred from its shape. A consumer
 * that reads this key can refuse a document it was not written against; one that has
 * to guess from which fields are present cannot tell an old record from a broken one.
 */
export const EVAL_SCHEMA = 'support-triage/eval-run@1';

/** `trajectories/<line>.json`, beside the markdown of the same name. */
export function recordFile(pipeline: string): string {
  return `${pipeline}.json`;
}

/** Where the numbers came from: the code, the model, and the files on disk. */
export interface EvalProvenance {
  /** The commit the run was produced at, so the code behind a number is nameable. */
  readonly commit: string;
  /** `LlmSession.label` — which client answered, and out of which cache. */
  readonly llmLabel: string;
  readonly params: LlmParams;
  /** The committed inputs. Named as paths, so a reader can open them. */
  readonly inputs: {
    readonly cases: string;
    readonly cache: string;
  };
  /** The command that reproduces this file, byte for byte, with no API key. */
  readonly command: string;
}

export interface EvalRecord {
  readonly schema: typeof EVAL_SCHEMA;
  readonly provenance: EvalProvenance;
  /** The scorecard, whole. Every figure the markdown quotes is one of these fields. */
  readonly scorecard: Scorecard;
  /**
   * Every case, in the order they were handed to the line — not the four the markdown
   * shows. The rendered document is a slice on purpose; this is not.
   */
  readonly run: PipelineRun;
}

export function buildRecord(input: {
  readonly run: PipelineRun;
  readonly scorecard: Scorecard;
  readonly commit: string;
  readonly llmLabel: string;
  readonly params: LlmParams;
}): EvalRecord {
  return {
    schema: EVAL_SCHEMA,
    provenance: {
      commit: input.commit,
      llmLabel: input.llmLabel,
      params: input.params,
      inputs: { cases: 'fixtures/cases.json', cache: CACHE_LABEL },
      command: 'yarn eval --replay',
    },
    scorecard: input.scorecard,
    run: input.run,
  };
}

/**
 * The document as it is written: two-space indent and a closing newline, so a diff
 * between two runs is a diff between two results rather than between two layouts.
 */
export function serialiseRecord(record: EvalRecord): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}

/**
 * The written text, read back as the value the renderer is given.
 *
 * Round-tripping rather than rendering from the in-memory object is the whole point:
 * anything that does not survive `JSON.stringify` — an `undefined`, a `Map`, a method —
 * disappears here and takes its line of the markdown with it, loudly, at the moment it
 * is introduced. The cast is the boundary: this program wrote the text one statement
 * ago, and a validator for a shape we just serialised would assert our own arithmetic.
 * A hand-edited file is not in scope — regenerating is one command.
 */
export function parseRecord(raw: string): EvalRecord {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('eval record: expected a JSON object.');
  }
  const schema = (parsed as Record<string, unknown>).schema;
  if (schema !== EVAL_SCHEMA) {
    throw new Error(
      `eval record: schema is ${JSON.stringify(schema)}, expected "${EVAL_SCHEMA}".`,
    );
  }
  return parsed as EvalRecord;
}
