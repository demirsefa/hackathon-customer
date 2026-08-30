/**
 * A played scenario rendered as the trajectory deliverable — dev/CHALLENGE.md §4,
 * deliverable 4.
 *
 * `src/eval/trajectory.ts` shows one agent deciding twenty-eight messages. This file
 * shows the other half of the same agent's job: the queue those decisions produced, and
 * one operator working it with a shift, a lunch break and a weekend in the way. The
 * numbers in `## The metric` are the ones the README quotes, and the slice underneath
 * is there so a reader can watch the ordering happen instead of taking it on trust —
 * what she opened, when, and which critical cases the four-hour window closed on.
 *
 * Pure: it returns the file's text and never writes it. The write belongs to the entry
 * point, which is what lets the format be checked without a filesystem.
 *
 * There is no timestamp in the output, for the reason the evaluation trajectory gives:
 * a replayed run is a function of the commit and the committed cache, both named below,
 * so a clock would add diff noise without adding anything a reader could reproduce from.
 */
import {
  workingMinutesPerDay,
  casesPerDay,
  type OperatorConfig,
} from '../core/operator.ts';
import type { PlayedArrival, Timeline } from './play.ts';
import { recordFile, type SimRecord } from './record.ts';
import { dayClock, localClock, windowLabel } from './report.ts';
import { missedCaseIds, type MissReason } from './score.ts';

/**
 * `trajectories/<line>-<scenario>.md`.
 *
 * The line's name is first and unqualified, which is what dev/contracts/SUBMISSION.md
 * rule 4 looks for; the scenario follows it because one agent has more than one run
 * worth showing, and `baseline.md` is already the evaluation's.
 */
export function trajectoryFile(pipeline: string, scenario: string): string {
  return `${pipeline}-${scenario}.md`;
}

/**
 * How many openings the slice shows before it says how many it left out.
 *
 * A slice, not the whole walk: ninety rows is an archive and nobody reads an archive.
 * The first of them are the ones that matter — that is the morning the queue is being
 * ordered, and the window closes while it is still going.
 */
const SLICE_ROWS = 24;

const percent = (part: number, whole: number): string =>
  whole === 0 ? '—' : `${String(Math.round((part / whole) * 100))}%`;

const ids = (caseIds: readonly string[]): string =>
  caseIds.length === 0 ? 'none' : caseIds.map((id) => `\`${id}\``).join(', ');

const MISS_REASON: Readonly<Record<MissReason, string>> = {
  auto_sent: 'answered automatically — she never saw it',
  not_reached: 'still in the queue when the run ended',
  opened_late: 'opened, but after the window had closed',
};

function operatorTable(operator: OperatorConfig): readonly string[] {
  const breaks = operator.breaks
    .map((span) => `${dayClock(span.startMinute)}–${dayClock(span.endMinute)}`)
    .join(', ');

  return [
    '| Field | Value |',
    '| ----- | ----- |',
    `| Operator | \`${operator.id}\` |`,
    `| Shift | ${dayClock(operator.shift.startMinute)}–${dayClock(operator.shift.endMinute)} ${operator.timezone} |`,
    `| Breaks | ${breaks === '' ? 'none' : breaks} |`,
    `| Workdays | ISO ${operator.workdays.join(', ')} (1 = Monday … 7 = Sunday) |`,
    `| Minutes per case | ${String(operator.minutesPerCase)} |`,
    `| Working minutes per day | ${String(workingMinutesPerDay(operator))} |`,
    `| Capacity | ${String(casesPerDay(operator))} cases a day |`,
  ];
}

/**
 * The openings in the order she made them, capped.
 *
 * `within window` is the column the whole file exists for: it turns over from yes to no
 * partway down, and where it turns over is what the ordering decided.
 */
function sliceRows(input: {
  readonly timeline: Timeline;
  readonly opened: readonly PlayedArrival[];
}): readonly string[] {
  const { timeline } = input;
  const zone = timeline.operator.timezone;

  const rows = input.opened.slice(0, SLICE_ROWS).map((arrival, index) => {
    const waited = arrival.waitedWorkingMinutes ?? 0;
    return (
      [
        `| ${String(index + 1)}`,
        localClock(arrival.openedAt ?? '', zone),
        `\`${arrival.messageId}\` · \`${arrival.caseId}\``,
        String(arrival.decision.priority),
        `\`${arrival.decision.reason}\``,
        String(waited),
        waited <= timeline.windowMinutes ? 'yes' : '**no**',
        arrival.critical ? '**yes**' : 'no',
      ].join(' | ') + ' |'
    );
  });

  const elided = input.opened.length - rows.length;
  const last = input.opened[input.opened.length - 1];

  return [
    '| # | Opened | Message · case | Priority | Reason | Waited (working min) | Within window | Critical |',
    '| - | ------ | -------------- | -------- | ------ | -------------------- | ------------- | -------- |',
    ...rows,
    ...(elided > 0 && last !== undefined
      ? [
          '',
          `…and ${String(elided)} more, the last of them at ${localClock(last.openedAt ?? '', zone)}.`,
        ]
      : []),
  ];
}

export function renderTrajectory(record: SimRecord): string {
  const { coverage, provenance, timeline } = record;
  const { commit, params } = provenance;
  const zone = timeline.operator.timezone;

  const opened = timeline.played
    .filter((arrival) => arrival.openedAt !== null)
    .sort((left, right) => ((left.openedAt ?? '') < (right.openedAt ?? '') ? -1 : 1));

  const missedRows = missedCaseIds(coverage).map((caseId) => {
    const misses = coverage.missed.filter((miss) => miss.caseId === caseId);
    const reasons = [...new Set(misses.map((miss) => MISS_REASON[miss.reason]))];
    return `| \`${caseId}\` | ${String(misses.length)} | ${reasons.join('; ')} |`;
  });

  return [
    `# Trajectory — \`${timeline.pipeline}\` playing \`${timeline.scenario}\``,
    '',
    `One agent and one operator, ${String(coverage.arrivals)} messages arriving at stated instants`,
    'and handed to the line one at a time. Produced by',
    `\`yarn sim ${timeline.scenario} --replay\`, which reads the committed model responses, so this`,
    'file is reproducible on a machine with no API key.',
    '',
    `**This document is a rendering.** The run itself is \`trajectories/${recordFile(timeline.pipeline, timeline.scenario)}\` —`,
    'every arrival, its decision, when she opened it and how long it waited, as JSON. The',
    'queue below is a slice of it; that file is not. This page is generated from it and',
    'states nothing it does not contain.',
    '',
    'This is the run the **primary metric** comes out of. The evaluation trajectory beside it',
    'shows the same agent deciding; this one shows what those decisions cost a person with a',
    'shift, a lunch break and a weekend in the way.',
    '',
    '## The run',
    '',
    '| Field | Value |',
    '| ----- | ----- |',
    `| Line | \`${timeline.pipeline}\` |`,
    `| Scenario | \`${timeline.scenario}\` |`,
    `| Commit | \`${commit}\` |`,
    `| Model | \`${params.model}\`, max tokens ${String(params.maxTokens)}, effort ${params.effort} |`,
    `| Client | ${provenance.llmLabel} |`,
    `| Arrivals | ${String(coverage.arrivals)} |`,
    `| First opened | ${localClock(timeline.startedAt, zone)} |`,
    `| Run ends | ${localClock(timeline.horizonAt, zone)} — ${windowLabel(timeline.windowMinutes)} after the last arrival, past which no queued case could still be reached in time |`,
    '',
    '## The operator model',
    '',
    'Identical for every line; only the queue she is handed differs (dev/CHALLENGE.md §10).',
    'She makes no decisions — she takes whatever the ordering put on top.',
    '',
    ...operatorTable(timeline.operator),
    '',
    '## The metric',
    '',
    '| Metric | Value |',
    '| ------ | ----- |',
    `| **Critical coverage** | ${String(coverage.criticalReached)} / ${String(coverage.critical)} (${percent(coverage.criticalReached, coverage.critical)}) opened within ${windowLabel(coverage.windowMinutes)} of arriving |`,
    `| Held for the operator | ${String(coverage.queued)} of ${String(coverage.arrivals)} arrivals |`,
    `| Opened | ${String(coverage.opened)} of ${String(coverage.queued)} held (${percent(coverage.opened, coverage.queued)}) |`,
    `| Still queued at the horizon | ${String(coverage.stillQueued)} |`,
    `| Average wait | ${coverage.averageWaitMinutes === null ? '—' : `${String(coverage.averageWaitMinutes)} working minutes`} |`,
    `| Interim messages sent | ${String(coverage.interimSent)} |`,
    `| Model calls | ${String(coverage.llmCalls)} total, ${(coverage.llmCalls / Math.max(1, coverage.arrivals)).toFixed(2)} per arrival |`,
    '',
    '## Critical cases not reached in time',
    '',
    coverage.missed.length === 0
      ? 'None. Every critical arrival was opened inside the window.'
      : `${String(coverage.missed.length)} critical arrival(s), across ${String(missedCaseIds(coverage).length)} distinct case(s): ${ids(missedCaseIds(coverage))}.`,
    '',
    ...(coverage.missed.length === 0
      ? []
      : [
          '| Case | Arrivals missed | Why |',
          '| ---- | --------------- | --- |',
          ...missedRows,
          '',
          'A case answered automatically is the expensive row here. No ordering reaches it: the',
          'reply was already with the customer, and the operator never saw that it existed.',
          '',
        ]),
    '## The queue, as she worked it',
    '',
    `${String(Math.min(SLICE_ROWS, opened.length))} of ${String(opened.length)} openings, in order. Times are on her own clock (${zone}).`,
    '',
    ...sliceRows({ timeline, opened }),
    '',
    '## The human checkpoint',
    '',
    `Every one of the ${String(coverage.queued)} held arrival(s) above required her approval before anything`,
    'reached the customer, and none of them was answered by this program. The interim message',
    `is the one thing that went out on its own — ${String(coverage.interimSent)} of them — and it says only that the`,
    'message was received. It never answers the question, it never leaves the queue, and it is',
    'sent on a wall clock rather than on her shift, because a customer waiting on a Saturday',
    'does not know that the desk is closed.',
    '',
  ].join('\n');
}
