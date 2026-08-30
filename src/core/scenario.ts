/**
 * A scenario as a value: parsed, validated, typed — and resolved against the case set.
 *
 * The same split `cases.ts` uses. `core/` reads no files, so this takes already-decoded
 * JSON and hands back the operator's calendar and the arrivals; the `readFile` belongs
 * to `src/sim/`, which is what keeps a scenario drivable from a test that has no
 * filesystem in mind.
 *
 * A scenario says **when** each message arrives and nothing about what it says. The
 * text comes from `fixtures/cases.json`, and one case arrives many times under
 * different message ids — the desk hears the same twenty-eight problems all morning,
 * from different people, and the queue has to order the copies as well as the originals.
 * `resolveArrivals` is where the two files are joined.
 */
import type { InboundMessage } from '../types/message.ts';
import type { OperatorConfig } from '../types/operator.ts';
import type { Arrival, Scenario } from '../types/scenario.ts';
import { shapeChecks, type ShapeChecks } from '../utils/parse.ts';
import type { CaseSubset, EvaluationCase } from './cases.ts';
import { isInstant } from './message.ts';
import { parseOperatorConfig } from './operator.ts';

const checks = shapeChecks('scenario file');
const { asRecord, asText } = checks;
// Annotated rather than destructured, so its `never` still narrows — see `ShapeChecks`.
const fail: ShapeChecks['fail'] = checks.fail;

function parseArrival(value: unknown, path: string): Arrival {
  const source = asRecord(value, path);
  const at = asText(source, 'at', path);
  if (!isInstant(at)) {
    fail(`${path}.at`, 'must be an ISO timestamp carrying an explicit offset');
  }

  return {
    messageId: asText(source, 'messageId', path),
    caseId: asText(source, 'caseId', path),
    at,
  };
}

/**
 * The one operator, or an explanation. An empty list and a list of two are different
 * mistakes and get different sentences, because "the player takes one operator" is not
 * a thing a reader should have to infer from a stack trace.
 */
function parseOperator(value: unknown): OperatorConfig {
  if (!Array.isArray(value)) {
    fail('operators', 'must be an array holding exactly one operator');
  }
  if (value.length !== 1) {
    fail(
      'operators',
      `must hold exactly one operator — the desk this project measures is one person (dev/CHALLENGE.md §6), and this file lists ${String(value.length)}`,
    );
  }

  try {
    return parseOperatorConfig(value[0]);
  } catch (error) {
    // Re-signed with the file it came from. `parseOperatorConfig` says which field is
    // wrong and this says which document to open; neither sentence alone is enough.
    throw new Error(
      `scenario file: operators[0] — ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/**
 * Validates decoded JSON and returns the scenario, or throws saying which field failed.
 *
 * Thrown rather than returned, for the reason `cases.ts` gives: an unusable scenario
 * file means the metric about to be printed is not the metric anyone agreed to.
 */
export function parseScenario(value: unknown): Scenario {
  const source = asRecord(value, 'root');
  const raw = source.arrivals;

  if (!Array.isArray(raw) || raw.length === 0) {
    fail('arrivals', 'must be a non-empty array');
  }

  const arrivals = raw.map((entry, index) => parseArrival(entry, `arrivals[${index}]`));

  const seen = new Set<string>();
  for (const arrival of arrivals) {
    if (seen.has(arrival.messageId)) {
      // Not pedantry: `messageId` is the last key of the queue's total order, so a
      // duplicate is two cases the ordering cannot separate — the exact ambiguity the
      // third key exists to remove.
      fail('arrivals', `lists messageId "${arrival.messageId}" twice`);
    }
    seen.add(arrival.messageId);
  }

  // Sorted here rather than trusted, so a hand-edited file plays the same run as a
  // generated one. Message id breaks the tie for the same reason the queue does.
  const sorted = [...arrivals].sort((left, right) => {
    const difference = Date.parse(left.at) - Date.parse(right.at);
    if (difference !== 0) return difference;
    if (left.messageId < right.messageId) return -1;
    return left.messageId > right.messageId ? 1 : 0;
  });

  return {
    name: asText(source, 'name', 'root'),
    operator: parseOperator(source.operators),
    arrivals: sorted,
  };
}

/**
 * One arrival with its case attached: the ground truth to score it against, and the
 * message as the pipeline will receive it.
 */
export interface ResolvedArrival {
  readonly messageId: string;
  readonly caseId: string;
  readonly subset: CaseSubset;
  /** Ground truth: a message the operator genuinely had to reach. The numerator. */
  readonly critical: boolean;
  readonly arrivedAt: string;
  readonly message: InboundMessage;
}

/**
 * Joins a scenario to the case set it names.
 *
 * The envelope is re-stamped and the **text is not touched**. That is what makes the
 * replay cache cover a ninety-arrival run out of twenty-eight recordings: a prompt is
 * built from the text alone, so the same case under a new message id hashes to the key
 * that is already in `fixtures/llm-cache.json`. Changing the text here — even to note
 * which copy it is — would put eighty-nine of them out of reach of the free run.
 *
 * Every unknown case id is collected before throwing. A scenario that names three
 * cases the set does not have should be fixed once, not three times.
 */
export function resolveArrivals(input: {
  readonly scenario: Scenario;
  readonly cases: readonly EvaluationCase[];
}): readonly ResolvedArrival[] {
  const byId = new Map(input.cases.map((entry) => [entry.caseId, entry]));

  const unknown = [
    ...new Set(
      input.scenario.arrivals
        .filter((arrival) => !byId.has(arrival.caseId))
        .map((arrival) => arrival.caseId),
    ),
  ];

  if (unknown.length > 0) {
    throw new Error(
      `scenario "${input.scenario.name}": no such case in the evaluation set: ${unknown.join(', ')}`,
    );
  }

  return input.scenario.arrivals.map((arrival) => {
    const found = byId.get(arrival.caseId);
    if (found === undefined) {
      // Unreachable: the loop above collected every miss. Stated rather than cast away,
      // because a silent `!` here would be a wrong number rather than an exception.
      throw new Error(`scenario: case "${arrival.caseId}" vanished between two lookups`);
    }

    return {
      messageId: arrival.messageId,
      caseId: found.caseId,
      subset: found.subset,
      critical: found.critical,
      arrivedAt: arrival.at,
      message: {
        ...found.message,
        messageId: arrival.messageId,
        receivedAt: arrival.at,
      },
    };
  });
}
