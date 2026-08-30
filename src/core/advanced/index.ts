/**
 * The advanced line, as dev/CHALLENGE.md §9 describes it.
 *
 * The same capabilities as the baseline, reached by a different arrangement, and the
 * arrangement is the whole claim. Three things move:
 *
 * **The record layer is opened first, and it decides on its own.** Who the sender is,
 * whether the keys in the text resolve, and who owns what they resolve to are facts
 * the records hold and the text cannot establish. Reading them first costs nothing and
 * settles the cases the baseline is structurally blind to — which is why those
 * decisions come back carrying `llmCalls: 0`. That number is the claim, checkable.
 *
 * **Classification is held apart from the draft.** One call that returns a category
 * and a reply lets the model pick the category that suits the reply it has already
 * begun. Split, the classifier has no draft to justify, and it can be asked a question
 * the baseline's single call cannot ask honestly: is this text aimed at the system?
 * In one call the attack and the answer are the same generation — the model reporting
 * on the instruction is the model that just followed it. The recorded baseline run
 * shows the near miss: on two injection cases the model *named* the attack in its
 * category, and the single risk check, reading a category it had no word for, sent the
 * reply anyway.
 *
 * **Nothing is sent that the record layer did not permit.** The draft is checked
 * against the orders this sender was shown to own — by a rule, deterministically, and
 * there is no model opinion behind it to argue with. A second opinion was tried here
 * and removed: over the committed set it was asked eight times, refused four, and all
 * four were replies that should have gone out. A model reviewing its own draft is not
 * independent evidence, and the one question with a right answer had already been
 * answered. The run that measured it is in the README's Improvement Changelog.
 *
 * Cost: 0 model calls when the records answer, 1 when the classification does, 2 for a
 * message that reaches a customer — the same one-call-per-decision average the baseline
 * spends, which is what dev/contracts/FEATURE-PARITY.md rule 6 asks to be stated.
 *
 * On priority: every hold here takes the reason's own score rather than passing one of
 * its own, because each reason is a fact this line established. The baseline has only
 * the model's urgency and passes that. Which of the two orders the operator's morning
 * better is the primary metric, and it is measured rather than argued.
 */
import { gateOnAuthority, permittedOrderIds, resolveAuthority } from '../authority.ts';
import { autoSend, humanReview, type Decision } from '../decision.ts';
import type { Pipeline } from '../pipeline.ts';
import {
  CONFIDENCE_THRESHOLD,
  draftCommitsToSensitiveAction,
  isSensitive,
  validateDraft,
} from '../policy.ts';
import { buildClassifyPrompt, parseClassifyOutput } from './classify.ts';
import { buildDraftPrompt, parseDraftOutput } from './draft.ts';

export const advanced: Pipeline = {
  name: 'advanced',
  async run({ message, records, llm }): Promise<Decision> {
    const messageId = message.messageId;

    // 1. The record gate. No model has been called yet, and for the messages it holds
    //    none ever is: the sender is unknown, or a key resolves to nothing, or the
    //    order belongs to somebody else. Its verdict is final by design — see
    //    `authority.ts` — so nothing below may lift it.
    const authority = resolveAuthority(message, records);
    const gated = gateOnAuthority(messageId, authority);
    if (gated !== null) return gated;

    // 2. Classification, on the text alone. The record layer is never put in a prompt
    //    (`llm.ts`): a prompt holding both a customer's words and a verified fact is
    //    one generated sentence away from the words overwriting the fact.
    const classification = await llm.complete({
      prompt: buildClassifyPrompt(message.text, message.threadSummary),
    });

    const classified = parseClassifyOutput(classification.text);
    if (classified === null) {
      return humanReview({ messageId, reason: 'model_output_unusable', llmCalls: 1 });
    }

    // 3. The gate. Four reasons to stop, ordered by how much they are worth: text
    //    written at the system, a record question with no record in it, a category the
    //    desk never answers unread, and the model's own doubt.
    if (classified.instruction) {
      return humanReview({ messageId, reason: 'instruction_in_message', llmCalls: 1 });
    }

    // Only reachable when nothing in the text pointed at a record — `authority` has
    // already resolved every key that did. Asked about her own order while naming
    // none of it, she gets a person; asked whether we deliver to İzmir, she does not.
    if (authority.kind === 'no_reference' && classified.needsRecord) {
      return humanReview({
        messageId,
        reason: 'unreferenced_record_request',
        llmCalls: 1,
      });
    }

    if (isSensitive(classified.category)) {
      return humanReview({ messageId, reason: 'sensitive_category', llmCalls: 1 });
    }

    if (classified.confidence < CONFIDENCE_THRESHOLD) {
      return humanReview({ messageId, reason: 'low_confidence', llmCalls: 1 });
    }

    // 4. Only now is a reply written, and only for a message four checks let through.
    const drafting = await llm.complete({
      prompt: buildDraftPrompt(message.text, message.threadSummary),
    });

    const draft = parseDraftOutput(drafting.text);
    if (draft === null) {
      return humanReview({ messageId, reason: 'model_output_unusable', llmCalls: 2 });
    }

    // 5. The deterministic check runs first and cannot be talked out of it: a reply may
    //    name only the orders this sender was shown to own. Asking the model about the
    //    draft before this would spend a call on a question already answered, and would
    //    let an opinion stand where a fact belongs.
    const verdict = validateDraft(draft, permittedOrderIds(authority));
    if (!verdict.ok) {
      return humanReview({
        messageId,
        reason: 'draft_policy_violation',
        draft,
        llmCalls: 2,
      });
    }

    // 6. Last, the one question the gate above could not have asked. Step 3 judged the
    //    message and let it through on a category about the message — `wrong_item_received`,
    //    confident, not sensitive. The reply to that same message offers a full refund.
    //    Nothing had compared the two, because at the moment the category was judged the
    //    draft did not exist yet. This reads the draft, which is generated text and the
    //    weakest evidence in the line; it is placed here, and only here, because from
    //    this position it can add a hold and can never lift one.
    if (draftCommitsToSensitiveAction(draft)) {
      return humanReview({
        messageId,
        reason: 'sensitive_category',
        draft,
        llmCalls: 2,
      });
    }

    return autoSend({ messageId, draft, llmCalls: 2 });
  },
};
