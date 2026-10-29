import { ChatOpenAI, ChatOpenAICompletions } from '@langchain/openai';

/**
 * OpenRouter (and other OpenAI-compatible gateways) stream chain-of-thought on
 * `delta.reasoning` (plain text) and `delta.reasoning_details` (structured
 * blocks). @langchain/openai's completions converter only forwards
 * `reasoning_content`, so every other shape is dropped before
 * aguiTranslator.extractReasoningDelta can see it — reasoning-capable models
 * behind those gateways streamed no REASONING_* events at all.
 *
 * Copy the provider's raw fields onto additional_kwargs unchanged; the
 * translator owns shape normalization so both live streaming and the final
 * accumulated message share one extraction path.
 */
function forwardReasoningFields(target, source) {
  if (!target || !source || typeof source !== 'object') return target;
  for (const key of ['reasoning', 'reasoning_details']) {
    if (source[key] !== undefined) {
      target.additional_kwargs = { ...target.additional_kwargs, [key]: source[key] };
    }
  }
  return target;
}

/**
 * ChatOpenAI (>=1.4) delegates every Chat Completions call to its own
 * `completions` instance, so the converter has to be overridden there and the
 * instance injected — overriding it on ChatOpenAI itself is never called.
 */
class ReasoningChatOpenAICompletions extends ChatOpenAICompletions {
  _convertCompletionsDeltaToBaseMessageChunk(delta, rawResponse, defaultRole) {
    const chunk = super._convertCompletionsDeltaToBaseMessageChunk(
      delta,
      rawResponse,
      defaultRole
    );
    return forwardReasoningFields(chunk, delta);
  }

  _convertCompletionsMessageToBaseMessage(message, rawResponse) {
    const converted = super._convertCompletionsMessageToBaseMessage(message, rawResponse);
    return forwardReasoningFields(converted, message);
  }
}

function createReasoningChatOpenAI(fields) {
  return new ChatOpenAI({
    ...fields,
    completions: new ReasoningChatOpenAICompletions(fields),
  });
}

export { createReasoningChatOpenAI };
