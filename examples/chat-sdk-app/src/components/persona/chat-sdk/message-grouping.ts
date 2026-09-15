import type { PersonaMessage, PersonaToolCall, PersonaSubagentActivityEntry } from "@personaai/react";

export interface GroupedMessage {
  message: PersonaMessage;
  /** `role:"reasoning"` messages that streamed immediately before this one — undefined except on an assistant message with reasoning ahead of it. */
  reasoningPhases?: PersonaMessage[];
}

/**
 * Groups the SDK's flat `messages` array (reasoning phases as their own
 * `role:"reasoning"` entries, in stream order — the wire protocol's shape)
 * into pairs the visual layer can render: each assistant message paired
 * with the reasoning phases that preceded it. `message` is always the real
 * `PersonaMessage`, untouched — `reasoningPhases` is a sibling, not a field
 * grafted onto a copy of it. System messages are dropped.
 */
export function groupReasoning(messages: PersonaMessage[]): GroupedMessage[] {
  const result: GroupedMessage[] = [];
  let pending: PersonaMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;

    if (msg.role === "reasoning") {
      pending.push(msg);
      continue;
    }

    result.push({
      message: msg,
      reasoningPhases: msg.role === "assistant" && pending.length ? pending : undefined,
    });
    pending = [];
  }

  return result;
}

/**
 * A subagent (`task` tool call)'s `subagentActivity` is a flat timeline of
 * text/tool_start/tool_result entries, not its own message array — flatten
 * it into one assistant `PersonaMessage` so `SubagentSheet` can replay it
 * through the same `ChatMessage` component as a top-level turn.
 */
export function flattenSubagentActivity(
  toolCallId: string,
  activity: PersonaSubagentActivityEntry[]
): PersonaMessage[] {
  let content = "";
  const toolCalls: PersonaToolCall[] = [];
  const byName = new Map<string, PersonaToolCall>();
  let seq = 0;

  for (const entry of activity) {
    if (entry.kind === "text") {
      content += entry.delta ?? "";
    } else if (entry.kind === "tool_start") {
      const call: PersonaToolCall = {
        toolCallId: `${toolCallId}-sub-${seq++}`,
        toolName: entry.toolName ?? "tool",
        args: entry.args,
      };
      toolCalls.push(call);
      if (entry.toolName) byName.set(entry.toolName, call);
    } else if (entry.kind === "tool_result") {
      const call = entry.toolName ? byName.get(entry.toolName) : undefined;
      if (call) call.result = entry.result;
    }
  }

  return [
    {
      id: `${toolCallId}-subagent`,
      role: "assistant",
      content,
      createdAt: new Date(),
      toolCalls,
    },
  ];
}
