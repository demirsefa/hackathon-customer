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
 * NO CASE IS SCORED HERE, AND THE SCRIPTED MODEL BELOW IS NEVER A JUDGE OF ONE.
 * Until 30 Aug 2026 this file compared each line's route against the case's
 * `expectedRoute`, with the divergences listed in a `REACHES` table — a per-case
 * correctness measurement, taken over a keyword scan written twenty lines further
 * down. It read seventeen of the twenty-eight the way ground truth does where the
 * recorded model reads twelve (`trajectories/baseline.json`), so the cheapest way to
 * turn this file green was to add a word to a list rather than to fix a line. Part of
 * what it measured was its own fake. Correctness belongs to `src/eval/`, which runs
 * the recorded model over these same cases, and the table is gone.
 *
 * What the scripted model is still for is varying the *opinion* a line is handed, so
 * that vocabulary, the approval gate, the decision shape and the call budget can be
 * checked without spending a model call. None of those depend on what it answers.
 *
 * The one thing the removed table did carry — the alarm for a line that stopped
 * behaving like itself — is kept, and moved onto evidence: the last block of this file
 * drives both lines over the 28 cases with the **recorded** model and compares every
 * route to the one committed in `trajectories/<line>.json`, the way
 * `src/__test__/unit/sim-determinism.test.ts` ties the published coverage to the code
 * that is running now. A design change still turns this red; a word in a list no
 * longer moves it.
 *
 * THE THREE SUSPENDED ASSERTIONS ARE BACK, with the first of them corrected. While
 * `PIPELINES` held one line they had nothing to compare, and the note that recorded
 * the suspension described the first as "the same route and the same reason code on
 * both sides of every case". That was never what the contract says. Rule 2 asks for
 * "identical fields, same vocabulary of routes and reason codes" — a shared vocabulary,
 * not a shared verdict. Per-case route equality would have made the two lines agree by
 * contract and left the primary metric measuring nothing, which is the failure rule 1
 * exists to prevent. So what runs now is what rule 2 always said:
 *
 *   1. every decision's route and reason come from the shared vocabulary — `ROUTES`
 *      and `REASON_CODES`, exported as values so the check can be made at all;
 *   2. `decisionFields` compared between the two lines rather than to a fixed list;
 *   3. the stated model-call budget as a ratio — one call against at most two.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseCaseFile, type EvaluationCase } from '../../core/cases.ts';
import {
  decisionFields,
  honoursApprovalGate,
  REASON_CODES,
  ROUTES,
  type Decision,
  type Route,
} from '../../core/decision.ts';
import { PIPELINES, type Pipeline } from '../../core/pipeline.ts';
import { isSensitive } from '../../core/policy.ts';
import { createRecordStore } from '../../core/records.ts';
import { parseRecord, recordFile } from '../../eval/record.ts';
import { PINNED_PARAMS } from '../../llm/key.ts';
import { readCache, replayClient } from '../../llm/replay.ts';
import type { InboundMessage } from '../../types/message.ts';
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

/**
 * The stated model-call budget per decision, which rule 6 asks to be written down
 * rather than discovered. The ratio is the point: the advanced line is allowed to
 * spend two where the baseline spends one, and a line that quietly grows past its
 * number turns this red before any result is reported anywhere.
 */
const BUDGET: Readonly<Record<string, number>> = {
  baseline: 1,
  advanced: 2,
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

/**
 * The two questions only the advanced classification pass asks, answered in the same
 * keyword-shaped way and for the same reason: what this file needs from a model is
 * that it read the text and nothing but the text.
 *
 * They are as blunt as the category scan above, and blunt in a direction that shows.
 * A real reader catches an instruction phrased politely; a substring list catches the
 * ones that shout. Nothing here is asserted against what they miss: how well an
 * instruction is spotted is a score, `src/eval/` runs the real model over these same
 * cases, and that is where the question belongs.
 */
const INSTRUCTION_SIGNALS: readonly string[] = [
  'previous instructions',
  'önceki talimat',
  'talimatları yoksay',
  'system notice',
  '<<system>>',
  '[admin]',
  'developer mode',
  'operator_override',
  'sistem yöneticisi',
];

/**
 * Words that make a message about the sender's *own* records rather than about the
 * shop. Possessive on purpose: the bare word `order` also appears in "no order yet",
 * which is a pre-sales question and the one message this rule must never hold. A
 * substring cannot read a negation, so it is not given the chance to try.
 */
const RECORD_SIGNALS: readonly string[] = [
  'siparişim',
  'siparişin',
  'my order',
  'hesabım',
  'hesabıma',
  'my account',
  'iade',
  'refund',
  'faturam',
  'my invoice',
  'işlem',
];

/**
 * A reply that names no order, so the permitted-order check has nothing to refuse and
 * a line that reaches a customer is observed reaching one.
 */
const ROUTINE_DRAFT = 'Merhaba, mesajınızı aldık ve en kısa sürede dönüş yapacağız.';

/** One model opinion per case, shaped for every line that will ever ask for it. */
function scriptFor(testCase: EvaluationCase): Record<TaskName, string> {
  const category = categoryFromTextAlone(testCase.message);
  const risky = isSensitive(category);
  const haystack = fold(
    `${testCase.message.text}\n${testCase.message.threadSummary ?? ''}`,
  );

  return agreeingScript({
    category,
    urgency: risky ? 80 : 20,
    confidence: risky ? 0.92 : 0.86,
    draft: ROUTINE_DRAFT,
    instruction: INSTRUCTION_SIGNALS.some((signal) => haystack.includes(signal)),
    needsRecord: RECORD_SIGNALS.some((signal) => haystack.includes(signal)),
  });
}

describe('feature parity', () => {
  it('drives every line from the one committed case table', () => {
    expect(CASES).toHaveLength(28);
  });

  describe.each(PIPELINES.map((pipeline) => [pipeline.name, pipeline] as const))(
    '%s',
    (_name: string, pipeline: Pipeline) => {
      describe.each(CASES.map((testCase) => [testCase.caseId, testCase] as const))(
        '%s',
        (_caseId: string, testCase: EvaluationCase) => {
          it('answers the message it was handed, in the shared vocabulary', async () => {
            const decision = await pipeline.run({
              message: testCase.message,
              records,
              llm: scriptedLlm(scriptFor(testCase)),
            });

            // Not which route: that is a score, and this model is a keyword scan. What
            // is asserted is that a decision came back for *this* message and said so
            // in words both lines share.
            expect(decision.messageId).toBe(testCase.message.messageId);

            // Rule 2, as the contract states it: one vocabulary, not one verdict. The
            // two lines are meant to disagree about cases — that disagreement is the
            // measurement — and meant never to disagree about the words they say it in.
            expect(ROUTES).toContain(decision.route);
            expect(REASON_CODES).toContain(decision.reason);
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
        };

        const decision = await pipeline.run({
          message: firstCase.message,
          records,
          llm: scriptedLlm(unusable),
        });

        expect(decision.route).toBe('human_review');
        expect(honoursApprovalGate(decision)).toBe(true);
        expect(REASON_CODES).toContain(decision.reason);
      });

      /**
       * The seven capabilities of dev/CHALLENGE.md §7, exhibited rather than declared.
       *
       * Rule 1 used to be checked by comparing two lists of feature names the lines
       * carried about themselves. That check passed whatever both sides wrote in them:
       * a capability neither line had was green as long as both claimed it, and one of
       * the seven — the interim message — was claimed by both while living entirely in
       * `policy.ts` and `src/sim/`, which is how it stayed green for as long as it did.
       *
       * So each capability is pinned to something observable in a decision. Three of
       * them need no probe, because `decision.ts` makes them unskippable: every
       * decision is built through `humanReview` or `autoSend`, so a reason code and a
       * matching approval requirement cannot be left off, and the table above already
       * checks the vocabulary they come from on all 28 cases, both lines.
       *
       * The remaining four need a witness, and take the same message from the table —
       * a routine order question both lines answer — with the model's opinion varied
       * around it. Varying the opinion rather than the message is the point: what is
       * asserted is what each line *does* with an answer, never how it got there.
       */
      describe('exhibits each capability of the brief', () => {
        const witness = firstCase.message;

        const decisionOn = async (category: string, urgency: number): Promise<Decision> =>
          pipeline.run({
            message: witness,
            records,
            llm: scriptedLlm(
              agreeingScript({
                category,
                urgency,
                confidence: 0.95,
                draft: ROUTINE_DRAFT,
              }),
            ),
          });

        const held = async (): Promise<Decision> => decisionOn('refund_request', 80);
        const routine = async (): Promise<Decision> => decisionOn('shipping_status', 20);

        it('assigns-category: reads the category, and the category changes the answer', async () => {
          expect((await held()).reason).toBe('sensitive_category');
          expect((await routine()).reason).toBe('routine_reply');
        });

        it('risky-never-auto-sent: a sensitive category is held for a person', async () => {
          const decision = await held();

          expect(decision.route).toBe('human_review');
          expect(decision.requiresApproval).toBe(true);
        });

        it('produces-draft: a routine message comes back with a reply in it', async () => {
          const decision = await routine();

          expect(decision.route).toBe('auto_send');
          expect(decision.draft ?? '').not.toBe('');
        });

        /**
         * As an order, not as a number. Which signal a line sorts by — the model's
         * urgency or the score of the reason it established — is the mechanism the
         * primary metric compares, and asserting either one here would settle by
         * contract the question `src/sim/` exists to measure.
         */
        it('assigns-urgency: the risky hold is read before the routine reply', async () => {
          const [risky, ordinary] = await Promise.all([held(), routine()]);

          expect(risky.priority).toBeGreaterThan(ordinary.priority);
          expect(risky.priority).toBeLessThanOrEqual(100);
          expect(ordinary.priority).toBeGreaterThanOrEqual(0);
        });
      });

      it('never spends more than its stated model-call budget', async () => {
        const budget = BUDGET[pipeline.name];
        expect(budget, `${pipeline.name} has no stated budget`).toBeDefined();

        for (const testCase of CASES) {
          const decision = await pipeline.run({
            message: testCase.message,
            records,
            llm: scriptedLlm(scriptFor(testCase)),
          });

          expect(
            decision.llmCalls,
            `${pipeline.name} spent ${String(decision.llmCalls)} on ${testCase.caseId}`,
          ).toBeLessThanOrEqual(budget ?? 0);
        }
      });
    },
  );

  /**
   * Rule 2's first half, compared between the lines rather than against a list written
   * here. A field added to one line's decision and not the other's is the break this
   * catches, and a list in this file would have to be edited to let it through — which
   * is exactly the edit nobody would notice making.
   */
  it('every line produces the same decision shape', async () => {
    const shapes = await Promise.all(
      PIPELINES.map(async (pipeline) => ({
        name: pipeline.name,
        fields: decisionFields(
          await pipeline.run({
            message: firstCase.message,
            records,
            llm: scriptedLlm(scriptFor(firstCase)),
          }),
        ),
      })),
    );

    const [reference, ...rest] = shapes;
    if (reference === undefined) throw new Error('there are no lines to compare');

    for (const shape of rest) {
      expect(shape.fields, `${shape.name} against ${reference.name}`).toEqual(
        reference.fields,
      );
    }
  });

  /**
   * Rule 6, as a ratio rather than as one line's number. The stated budget is also a
   * ceiling that has to be *reached*: a line whose declared cost nothing actually pays
   * is a resource difference reported larger than it is, which the rule exists to stop
   * in the other direction too.
   */
  it('each line reaches the budget it states, and no more', async () => {
    for (const pipeline of PIPELINES) {
      const spent = await Promise.all(
        CASES.map(
          async (testCase) =>
            (
              await pipeline.run({
                message: testCase.message,
                records,
                llm: scriptedLlm(scriptFor(testCase)),
              })
            ).llmCalls,
        ),
      );

      expect(Math.max(...spent), `${pipeline.name}'s most expensive case`).toBe(
        BUDGET[pipeline.name],
      );
    }
  });
});

/**
 * The one block here that is not a property of a line, and the only one that uses the
 * model a result was actually produced with.
 *
 * It replaces the `REACHES` table this file used to carry. That table's purpose was
 * sound — an alarm for a line that stopped behaving like its own design — but it was
 * written as a list of exceptions to `expectedRoute`, which made a contract check into
 * a scorer, over a keyword scan standing in for a model. The alarm survives by being
 * pointed at the committed evidence instead: `trajectories/<line>.json` is the run the
 * README quotes, produced by `yarn eval --replay` out of `fixtures/llm-cache.json`, and
 * a line whose behaviour moved no longer answers the way that file records.
 *
 * Nothing about ground truth is asserted. A route that is wrong here is wrong in the
 * committed file too, and both stay green — being wrong is what `src/eval/` counts and
 * what the README reports. What turns this red is a *change*, and then either the code
 * moved or the evidence is stale, which is the same fork
 * `src/__test__/unit/sim-determinism.test.ts` puts the sim numbers behind.
 */
describe('each line still decides what its committed evidence records', () => {
  const recorded = replayClient({ cache: readCache(), params: PINNED_PARAMS });

  describe.each(PIPELINES.map((pipeline) => [pipeline.name, pipeline] as const))(
    '%s',
    (name: string, pipeline: Pipeline) => {
      it('reaches, case for case, the route committed in its trajectory', async () => {
        const committed = parseRecord(
          readFileSync(
            new URL(`../../../trajectories/${recordFile(name)}`, import.meta.url),
            'utf8',
          ),
        );

        // The committed run has to cover the table, or the comparison below would pass
        // on the handful of cases that happen to be in both.
        expect(committed.run.runs).toHaveLength(CASES.length);

        const reached: Record<string, Route> = {};
        for (const testCase of CASES) {
          const decision = await pipeline.run({
            message: testCase.message,
            records,
            llm: recorded,
          });

          reached[testCase.caseId] = decision.route;
        }

        expect(reached).toEqual(
          Object.fromEntries(
            committed.run.runs.map((run) => [run.caseId, run.decision.route]),
          ),
        );
      });
    },
  );
});
