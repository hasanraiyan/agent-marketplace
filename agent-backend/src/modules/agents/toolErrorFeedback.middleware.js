import { createMiddleware } from 'langchain';
import { ToolMessage } from '@langchain/core/messages';
import { isGraphInterrupt } from '@langchain/langgraph';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

// A zod issue list for a large nested schema can run long; the model only
// needs enough to correct the call, not a full stack or schema dump.
const MAX_DETAIL_LENGTH = 1500;

/**
 * Strips the wrapper errors langchain adds so the model sees the real cause
 * (ToolInputParsingException's zod issues, or the MCP/REST error message)
 * instead of "Error invoking tool … with error: <stack>".
 */
export function unwrapToolError(error) {
  let current = error;
  for (let depth = 0; depth < 6 && current instanceof Error; depth += 1) {
    const next = current.toolError ?? current.cause;
    if (!(next instanceof Error)) break;
    current = next;
  }
  return current instanceof Error ? current : error;
}

export function formatToolErrorContent(error) {
  const root = unwrapToolError(error);
  const raw = String(root?.message || 'Tool execution failed.');
  const detail = raw.length > MAX_DETAIL_LENGTH ? `${raw.slice(0, MAX_DETAIL_LENGTH)}…` : raw;
  return `Error: ${detail}\nPlease fix the tool arguments if they were invalid and try again.`;
}

/**
 * Feeds a failed tool call back to the model as an `error` ToolMessage so it can
 * retry with corrected arguments, instead of the exception aborting the run.
 *
 * `createAgent` builds its ToolNode with langchain's `defaultHandleToolErrors`,
 * which re-throws any error that surfaced through a `wrapToolCall` chain. The
 * deepagents filesystem middleware always installs one (tool output eviction),
 * so without this every argument-validation failure — e.g. a model sending
 * `action: "list, get"` instead of a single enum member — killed the stream
 * with "Received tool input did not match expected schema" and the user got no
 * answer at all. Middleware added here runs innermost, so it catches the
 * ToolInvocationError before ToolNode's own (re-throwing) handler sees it.
 */
export function createToolErrorFeedbackMiddleware() {
  return createMiddleware({
    name: 'toolErrorFeedback',
    wrapToolCall: async (request, handler) => {
      try {
        return await handler(request);
      } catch (error) {
        // Interrupts are control flow (HITL/clarification) and an aborted run
        // must stop — neither is a tool the model should "retry".
        if (isGraphInterrupt(error) || request.runtime?.signal?.aborted) throw error;

        const toolCall = request.toolCall ?? {};
        const content = formatToolErrorContent(error);
        logger.warn('[Middleware][toolErrorFeedback] feeding tool error back to model', {
          tool: toolCall.name,
          toolCallId: toolCall.id,
          error: unwrapToolError(error)?.message?.slice(0, 300),
        });

        return new ToolMessage({
          status: 'error',
          name: toolCall.name,
          tool_call_id: toolCall.id ?? '',
          content,
        });
      }
    },
  });
}
