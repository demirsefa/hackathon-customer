/**
 * Enforcement for dev/contracts/FEATURE-PARITY.md.
 *
 * The project's primary number is the difference between two lines. If that
 * difference comes from a feature one has and the other lacks, the number measures
 * nothing — a missing `if`, not a better design. These checks pin the feature set,
 * the decision shape and the approval gate.
 *
 * The table is `fixtures/cases.json`, the same 28 cases `src/eval/` scores, which is
 * rule 4: both lines are measured on one table, never on two.
 *
 * WHAT IS ASSERTED HERE IS NOT THE GROUND TRUTH. A case's `expectedRoute` is where
 * the message belonged; whether a line got there is a *score*, and counting scores is
 * `src/eval/`'s job. What this file asserts is that each line lands where its own
 * design says it lands — so the baseline auto-sending an authority case is recorded
 * in `REACHES` as the designed behaviour it is (dev/CHALLENGE.md §8), and only a line
 * that stopped behaving like itself turns this red.
 *
 * SUSPENDED, NOT DELETED. Three assertions cannot run while `PIPELINES` holds one
 * line, and they come back with the advanced line (dev/CHALLENGE.md §9):
 *
 *   1. the same route and the same reason code on both sides of every case;
 *   2. `decisionFields` compared between the two lines rather than to a fixed list;
 *   3. the stated model-call budget as a comparison — one call against three.
 *
 * Until then the contract's cross-line half is suspended in the open, which is
 * recorded in the contract's Enforcement section too. It is not weakened quietly.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseCaseFile, type EvaluationCase } from '../../core/cases.ts';
import { decisionFields, honoursApprovalGate, type Route } from '../../core/decision.ts';
import type { InboundMessage } from '../../core/message.ts';
import { PIPELINES, REQUIRED_FEATURES, type Pipeline } from '../../core/pipeline.ts';
import { isSensitive } from '../../core/policy.ts';
import { createRecordStore } from '../../core/records.ts';
import { agreeingScript, scriptedLlm, type TaskName } from '../fakes.ts';

const caseFile = parseCaseFile(
  JSON.parse(
    readFileSync(new URL('../../../fixtures/cases.json', import.meta.url), 'utf8'),
  ),
);

const CASES = caseFile.cases;
const records = createRecordStore(caseFile);

const [firstCase] = CASES;
if (firstCase === undefined) throw new Error('the case table is empty');

/** The fields every decision carries, whichever line produced it. */
const DECISION_FIELDS: readonly string[] = [
  'draft',
  'llmCalls',
  'messageId',
  'priority',
  'reason',
  'requiresApproval',
  'route',
];

/**
 * Where a line lands when the ground truth says elsewhere, by case id.
 *
 * Not a list of bugs and not an allowance — it is the measurement, written down
 * where a change to it has to be deliberate. The baseline reads the text and nothing
 * else, so it auto-sends every case whose problem is in the record layer rather than
 * in the words. That is dev/CHALLENGE.md §8 working as designed; the day one of these
 * flips, this file goes red and somebody explains why.
 *
 * The count belongs to `src/eval/`. What belongs here is that it is not an accident.
 */
const REACHES: Readonly<Record<string, Readonly<Record<string, Route>>>> = {
  baseline: {
    // Held on a word. A thank-you note that mentions an invoice is a false positive,
    // and false positives cost the operator the same minutes a real case does.
    'norm-08': 'human_review',

    // Steered at a routine topic: nothing in the text names a risky category, so the
    // single risk check has nothing to fire on.
    'inj-04': 'auto_send',

    // The thesis of the project. Legitimate text, real order, wrong owner — a fact
    // that is only in the record layer, which this line is handed and never opens.
    'auth-01': 'auto_send',
    'auth-02': 'auto_send',
    'auth-03': 'auto_send',
    'auth-04': 'auto_send',
    'auth-05': 'auto_send',
    'auth-06': 'auto_send',

    // No concept of uncertainty (dev/CHALLENGE.md §8): an unresolvable reference and
    // a request with no content both come back as ordinary shipping questions.
    'amb-01': 'auto_send',
    'amb-03': 'auto_send',
    'amb-04': 'auto_send',
  },
};

/**
 * Text folded to lower case without losing a Turkish dotted capital — `'İ'` and
 * `'I'` both mean `i` here, which `toLowerCase` alone does not manage in either
 * direction.
 */
function fold(text: string): string {
  return text.replace(/[Iİ]/g, 'i').toLowerCase();
}

/**
 * The categories a reader of the text alone would reach for, in the order a support
 * desk would reach for them: money first, then access, then the rest.
 */
const TEXT_SIGNALS: readonly (readonly [string, readonly string[]])[] = [
  ['refund', ['iade', 'refund', 'money back', 'geri ödeme']],
  ['account_access', ['şifre', 'password', 'hesabıma erişim', 'giriş yapamıyorum']],
  ['legal', ['avukat', 'lawyer', 'legal action', 'tüketici hakem']],
  ['billing', ['fatura', 'invoice', 'billing', 'çift çekim']],
  ['complaint', ['şikayet', 'complaint']],
];

/**
 * A stand-in for what a competent model, given the text and nothing else, answers.
 *
 * It is deliberately keyword-shaped and deliberately cheap. A contract check is not
 * the place to spend model calls — `src/eval/` runs the real thing over the same 28
 * cases — and what this file needs from a model is only that it read the text and
 * nothing but the text, which is exactly what a keyword scan cannot help doing.
 */
function categoryFromTextAlone(message: InboundMessage): string {
  const haystack = fold(`${message.text}\n${message.threadSummary ?? ''}`);
  const signal = TEXT_SIGNALS.find(([, keywords]) =>
    keywords.some((keyword) => haystack.includes(keyword)),
  );

  return signal?.[0] ?? 'shipping';
}

/** One model opinion per case, shaped for every line that will ever ask for it. */
function scriptFor(testCase: EvaluationCase): Record<TaskName, string> {
  const category = categoryFromTextAlone(testCase.message);
  const risky = isSensitive(category);

  return agreeingScript({
    category,
    urgency: risky ? 80 : 20,
    confidence: risky ? 0.92 : 0.86,
    draft: 'Merhaba, mesajınızı aldık ve en kısa sürede dönüş yapacağız.',
  });
}

function routeReachedBy(pipeline: Pipeline, testCase: EvaluationCase): Route {
  return REACHES[pipeline.name]?.[testCase.caseId] ?? testCase.expectedRoute;
}

describe('feature parity', () => {
  it('every line declares exactly the required feature set', () => {
    const required = [...REQUIRED_FEATURES].sort();

    for (const pipeline of PIPELINES) {
      expect([...pipeline.features].sort()).toEqual(required);
    }
  });

  it('drives every line from the one committed case table', () => {
    expect(CASES).toHaveLength(28);
  });

  /**
   * A stale entry in `REACHES` is worse than none: it would quietly excuse a line
   * from a case that no longer exists, or from one it already gets right.
   */
  it('names only divergences that are still divergences', () => {
    const byId = new Map(CASES.map((entry) => [entry.caseId, entry]));

    for (const pipeline of PIPELINES) {
      for (const [caseId, route] of Object.entries(REACHES[pipeline.name] ?? {})) {
        const testCase = byId.get(caseId);

        expect(testCase, `${pipeline.name} names unknown case ${caseId}`).toBeDefined();
        expect(route, `${pipeline.name} agrees with ${caseId}`).not.toBe(
          testCase?.expectedRoute,
        );
      }
    }
  });

  describe.each(PIPELINES.map((pipeline) => [pipeline.name, pipeline] as const))(
    '%s',
    (_name: string, pipeline: Pipeline) => {
      describe.each(CASES.map((testCase) => [testCase.caseId, testCase] as const))(
        '%s',
        (_caseId: string, testCase: EvaluationCase) => {
          it('lands where its own design lands, in the shared decision shape', async () => {
            const decision = await pipeline.run({
              message: testCase.message,
              records,
              llm: scriptedLlm(scriptFor(testCase)),
            });

            expect(decision.route).toBe(routeReachedBy(pipeline, testCase));
            expect(decision.messageId).toBe(testCase.message.messageId);
            expect(decisionFields(decision)).toEqual(DECISION_FIELDS);
          });

          it('honours the human-approval gate', async () => {
            const decision = await pipeline.run({
              message: testCase.message,
              records,
              llm: scriptedLlm(scriptFor(testCase)),
            });

            expect(honoursApprovalGate(decision)).toBe(true);
          });
        },
      );

      /**
       * Not a case in the table: an unusable response is a property of the model, not
       * of the message. Every line owes the operator the same answer to it — hold,
       * with a reason — because a line that guesses instead is one that will guess in
       * front of a customer.
       */
      it('holds the message when the model comes back unusable', async () => {
        const unusable: Record<TaskName, string> = {
          triage: 'sorry, I cannot help with that',
          classify: 'sorry, I cannot help with that',
          draft: 'sorry, I cannot help with that',
          verify: 'sorry, I cannot help with that',
        };

        const decision = await pipeline.run({
          message: firstCase.message,
          records,
          llm: scriptedLlm(unusable),
        });

        expect(decision.route).toBe('human_review');
        expect(honoursApprovalGate(decision)).toBe(true);
        expect(decisionFields(decision)).toEqual(DECISION_FIELDS);
      });
    },
  );
});
