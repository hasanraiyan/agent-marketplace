import { EventType } from '@ag-ui/core';
import { randomUUID } from 'crypto';

// Extract the displayable string content of a tool's on_tool_end output.
//
// LangChain wraps a tool's return value in a ToolMessage whenever the call has a
// tool_call_id and the value isn't already a plain string (see core's
// _formatToolOutput). So when a tool returns an OBJECT (e.g. search_web's Tavily
// `{ query, results }`), event.data.output is a ToolMessage *instance* — and
// JSON.stringify(message) serializes LangChain's envelope
// (`{lc,type,id,kwargs:{content:"<the real payload>"}}`), burying the real result
// in kwargs.content. Unwrap to `.content` so the client receives the actual tool
// output (the JSON string / text), not the serialization envelope.
export function extractToolOutputContent(output) {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  // ToolMessage / BaseMessage: the payload lives on `.content`.
  if (typeof output.content === 'string') return output.content;
  if (Array.isArray(output.content)) {
    // Content blocks: concatenate text parts, stringify anything else.
    return output.content
      .map((b) => (typeof b === 'string' ? b : (b?.text ?? JSON.stringify(b))))
      .join('');
  }
  // Plain object (a tool that returned a raw object with no tool_call_id wrapping):
  // serialize it as before.
  return JSON.stringify(output ?? '');
}

export function buildToolCompletionNotice(toolName, resultContent) {
  const prettyName = String(toolName || 'tool')
    .split(/[_\-\s]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  let parsed = null;
  if (typeof resultContent === 'string' && resultContent.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(resultContent);
    } catch {
      parsed = null;
    }
  }

  if (parsed?.status === 'error') {
    return `The ${prettyName} tool finished with an error: ${parsed.message || 'Unknown error'}`;
  }

  if (parsed?.status === 'success' && parsed?.message) {
    return `${parsed.message}`;
  }

  return `${prettyName} completed.`;
}

// One-shot assistant text message (used for pre-stream errors: missing agent,
// build failure). Emitted as a single chunk; the runtime closes it at RUN_FINISHED.
export async function* emitTextNotice(delta) {
  yield { type: EventType.TEXT_MESSAGE_CHUNK, messageId: randomUUID(), role: 'assistant', delta };
}
