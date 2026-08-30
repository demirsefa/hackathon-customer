/**
 * The played scenario as data — `trajectories/<line>-<scenario>.json`.
 *
 * The counterpart of `src/eval/record.ts`, for the run the **primary metric** comes
 * out of. `trajectory.ts` renders a document a person reads, and shows the first
 * twenty-four openings of ninety arrivals because nobody reads an archive; this file
 * is the archive. Every arrival, its decision, when she opened it and how long it
 * waited — the numbers in `## The metric` are recomputable from `arrivals` alone.
 *
 * As in `src/eval/record.ts`, the markdown is rendered from the *parsed* serialisation
 * of this record, so the document cannot state a fact the JSON does not carry.
 *
 * One thing is deliberately absent: the prompts and raw model answers. A scenario
 * replays the same twenty-eight cases many times over, so the exchanges are the
 * twenty-eight in `fixtures/llm-cache.json` — named in `provenance.inputs.cache` —
 * and copying them ninety times would make the file bigger without making it say more.
 * `trajectories/<line>.json` is where the per-case steps live.
 */
import type { LlmParams } from '../llm/key.ts';
import { CACHE_LABEL } from '../llm/replay.ts';
import type { Timeline } from './play.ts';
import type { Coverage } from './score.ts';

/** Versioned in the file, for the reason `src/eval/record.ts` gives. */
export const SIM_SCHEMA = 'support-triage/sim-run@1';

/** `trajectories/<line>-<scenario>.json`, beside the markdown of the same name. */
export function recordFile(pipeline: string, scenario: string): string {
  return `${pipeline}-${scenario}.json`;
}

export interface SimProvenance {
  /** The commit the run was produced at, so the code behind a number is nameable. */
  readonly commit: string;
  /** `LlmSession.label` — which client answered, and out of which cache. */
  readonly llmLabel: string;
  readonly params: LlmParams;
  readonly inputs: {
    readonly scenario: string;
    readonly cases: string;
    readonly cache: string;
  };
  /** The command that reproduces this file, byte for byte, with no API key. */
  readonly command: string;
}

export interface SimRecord {
  readonly schema: typeof SIM_SCHEMA;
  readonly provenance: SimProvenance;
  /**
   * The primary metric, whole. `criticalReached / critical` is the headline number of
   * this project, and it is a division a reader can do themselves from these fields.
   */
  readonly coverage: Coverage;
  /** Every arrival, the operator model, and the window — not the rendered slice. */
  readonly timeline: Timeline;
}

export function buildRecord(input: {
  readonly timeline: Timeline;
  readonly coverage: Coverage;
  readonly commit: string;
  readonly llmLabel: string;
  readonly params: LlmParams;
}): SimRecord {
  const scenario = input.timeline.scenario;

  return {
    schema: SIM_SCHEMA,
    provenance: {
      commit: input.commit,
      llmLabel: input.llmLabel,
      params: input.params,
      inputs: {
        scenario: `scenarios/${scenario}.json`,
        cases: 'fixtures/cases.json',
        cache: CACHE_LABEL,
      },
      command: `yarn sim ${scenario} --replay`,
    },
    coverage: input.coverage,
    timeline: input.timeline,
  };
}

/** Two-space indent and a closing newline, so a diff shows results, not layout. */
export function serialiseRecord(record: SimRecord): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}

/** The written text, read back as the value the renderer is given. */
export function parseRecord(raw: string): SimRecord {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('sim record: expected a JSON object.');
  }
  const schema = (parsed as Record<string, unknown>).schema;
  if (schema !== SIM_SCHEMA) {
    throw new Error(
      `sim record: schema is ${JSON.stringify(schema)}, expected "${SIM_SCHEMA}".`,
    );
  }
  return parsed as SimRecord;
}
