import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

// Content block types supported by OpenAI Chat Completions API in message.content
const OPENAI_SUPPORTED_CONTENT_TYPES = new Set([
  'text',
  'image_url',
  'input_audio',
  'refusal',
  'audio',
  'file',
]);

/**
 * Inspects a message's content and returns information about incompatible blocks.
 *
 * @param {import('@langchain/core/messages').BaseMessage} message
 * @param {string} providerType - 'openai' | 'gemini' | 'anthropic' | 'deepseek' | 'custom'
 * @returns {{ hasIncompatible: boolean, types: string[], details: any[] }}
 */
export function inspectMessageContent(message, providerType = 'openai') {
  const content = message?.content;
  if (!Array.isArray(content)) {
    return { hasIncompatible: false, types: [], details: [] };
  }

  const incompatibleTypes = [];
  const details = [];

  for (const block of content) {
    if (!block || typeof block !== 'object') continue;

    const blockType = block.type || ('functionCall' in block ? 'functionCall' : 'functionResponse' in block ? 'functionResponse' : null);

    // OpenAI and OpenAI-compatible providers (deepseek, custom) reject 'functionCall', 'functionResponse', 'thinking'
    if (providerType === 'openai' || providerType === 'custom' || providerType === 'deepseek') {
      if (blockType && !OPENAI_SUPPORTED_CONTENT_TYPES.has(blockType)) {
        incompatibleTypes.push(blockType);
        details.push({
          type: blockType,
          preview: blockType === 'functionCall' ? block.functionCall?.name : blockType === 'thinking' ? (block.thinking?.slice(0, 50) + '...') : blockType,
        });
      }
    }
  }

  return {
    hasIncompatible: incompatibleTypes.length > 0,
    types: incompatibleTypes,
    details,
  };
}

/**
 * Sanitizes a single message for the target provider.
 *
 * Specifically handles:
 * 1. Gemini's `@langchain/google-genai` puts `{ type: 'functionCall', functionCall: { ... } }`
 *    into `AIMessage.content`. When switching to OpenAI or OpenAI-compatible models, OpenAI
 *    strictly rejects this with:
 *    "400 Invalid value: 'functionCall'. Supported values are: 'text', 'image_url', 'input_audio', 'refusal', 'audio', and 'file'."
 * 2. Stripping `functionCall` and `functionResponse` from `AIMessage.content`, while ensuring
 *    `message.tool_calls` preserves the call.
 * 3. Sanitizing `ToolMessage` content if wrapped in provider-specific objects.
 *
 * @param {import('@langchain/core/messages').BaseMessage} message
 * @param {string} providerType
 * @returns {{ message: import('@langchain/core/messages').BaseMessage, modified: boolean, changes: string[] }}
 */
export function sanitizeMessageForModel(message, providerType = 'openai') {
  if (!message) return { message, modified: false, changes: [] };

  const changes = [];
  const content = message.content;

  // For OpenAI, DeepSeek, and Custom (OpenAI-compatible) models
  if (providerType === 'openai' || providerType === 'custom' || providerType === 'deepseek') {
    if (Array.isArray(content)) {
      const recoveredToolCalls = [];
      const filteredContent = [];

      for (const block of content) {
        if (!block || typeof block !== 'object') {
          filteredContent.push(block);
          continue;
        }

        const isFunctionCall =
          block.type === 'functionCall' || ('functionCall' in block && Boolean(block.functionCall));
        const isFunctionResponse =
          block.type === 'functionResponse' || ('functionResponse' in block && Boolean(block.functionResponse));
        const isThinking = block.type === 'thinking';

        if (isFunctionCall) {
          changes.push(`Stripped 'functionCall' block (${block.functionCall?.name || 'unknown'})`);
          if (block.functionCall?.name) {
            recoveredToolCalls.push({
              id: block.functionCall.id || block.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              name: block.functionCall.name,
              args: block.functionCall.args || {},
            });
          }
          continue;
        }

        if (isFunctionResponse) {
          changes.push('Stripped Gemini functionResponse block from content');
          continue;
        }

        if (isThinking) {
          // If thinking block contains text, convert to standard text block if no other text is present
          if (block.thinking && typeof block.thinking === 'string') {
            changes.push('Converted thinking block to text block');
            filteredContent.push({ type: 'text', text: block.thinking });
          } else {
            changes.push('Stripped thinking block');
          }
          continue;
        }

        // Keep standard supported blocks
        filteredContent.push(block);
      }

      if (changes.length > 0) {
        // If all blocks were removed, empty string content is accepted by OpenAI when tool_calls is present
        let newContent = '';
        if (filteredContent.length === 1 && filteredContent[0]?.type === 'text') {
          newContent = filteredContent[0].text;
        } else if (filteredContent.length > 0) {
          newContent = filteredContent;
        }

        // Merge existing tool_calls with any recovered from the functionCall blocks
        const existingToolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
        const mergedToolCalls = [...existingToolCalls];
        for (const rec of recoveredToolCalls) {
          if (!mergedToolCalls.some((tc) => tc.name === rec.name && JSON.stringify(tc.args) === JSON.stringify(rec.args))) {
            mergedToolCalls.push(rec);
          }
        }

        // Clone with sanitized content
        if (AIMessage.isInstance(message) || message._getType?.() === 'ai' || message.type === 'ai') {
          const sanitizedMsg = new AIMessage({
            content: newContent,
            tool_calls: mergedToolCalls,
            id: message.id,
            name: message.name,
            additional_kwargs: { ...(message.additional_kwargs || {}) },
            response_metadata: { ...(message.response_metadata || {}) },
          });
          return { message: sanitizedMsg, modified: true, changes };
        }

        // Generic fallback clone
        const clone = Object.create(Object.getPrototypeOf(message));
        Object.assign(clone, message);
        clone.content = newContent;
        if (mergedToolCalls.length > 0) clone.tool_calls = mergedToolCalls;
        return { message: clone, modified: true, changes };
      }
    }

    // Handle ToolMessage with non-string content
    if (ToolMessage.isInstance(message) || message._getType?.() === 'tool' || message.type === 'tool') {
      if (Array.isArray(content)) {
        // Flatten or stringify array content for tool message
        const textParts = content
          .map((p) => {
            if (typeof p === 'string') return p;
            if (p?.text) return p.text;
            if (p?.functionResponse?.response) return JSON.stringify(p.functionResponse.response);
            return JSON.stringify(p);
          })
          .filter(Boolean);
        const stringContent = textParts.join('\n');
        changes.push('Stringified ToolMessage array content for OpenAI compatibility');

        const sanitizedMsg = new ToolMessage({
          content: stringContent,
          tool_call_id: message.tool_call_id,
          id: message.id,
          name: message.name,
          additional_kwargs: { ...(message.additional_kwargs || {}) },
        });
        return { message: sanitizedMsg, modified: true, changes };
      }
    }
  }

  return { message, modified: false, changes: [] };
}

/**
 * Sanitizes an entire array of messages for the target provider.
 *
 * @param {Array<import('@langchain/core/messages').BaseMessage>} messages
 * @param {string} providerType - 'openai' | 'gemini' | 'anthropic' | 'deepseek' | 'custom'
 * @returns {{ messages: Array<import('@langchain/core/messages').BaseMessage>, totalModified: number, modificationLog: Array<{ index: number, role: string, changes: string[] }> }}
 */
export function sanitizeMessagesForModel(messages, providerType = 'openai') {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { messages: messages || [], totalModified: 0, modificationLog: [] };
  }

  let totalModified = 0;
  const modificationLog = [];

  const sanitizedMessages = messages.map((msg, idx) => {
    const { message: sanitizedMsg, modified, changes } = sanitizeMessageForModel(msg, providerType);
    if (modified) {
      totalModified++;
      modificationLog.push({
        index: idx,
        role: msg._getType?.() || msg.type || 'unknown',
        changes,
      });
    }
    return sanitizedMsg;
  });

  if (totalModified > 0) {
    logger.info(`[AG-UI][Step 4/6: Message Sanitization] Cleaned ${totalModified} message(s) for provider '${providerType}'`, {
      providerType,
      totalModified,
      details: modificationLog,
    });
  }

  return {
    messages: sanitizedMessages,
    totalModified,
    modificationLog,
  };
}
