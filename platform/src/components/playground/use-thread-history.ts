import * as React from "react";
import { getProjectAgentThreadMessages } from "@/lib/api/projects";
import type { HookChatMessage, HookToolCall, HookConversationEntry } from "./use-chat-ui";

/**
 * Normalizes the `test/agui`-shaped thread-messages response (also served
 * identically for the Architect's own threads) into `useAguiChat`'s
 * `initialMessages`/`initialAgentState` shape. Generic — not Agent-specific
 * — shared by both `agent-chat.tsx` and `architect-chat.tsx`.
 */
export function normalizeCheckpointData(data: unknown): {
  messages: HookChatMessage[];
  toolCalls: HookToolCall[];
  conversation: HookConversationEntry[];
  agentState: Record<string, unknown>;
} {
  const messages: HookChatMessage[] = [];
  const toolCalls: HookToolCall[] = [];
  const conversation: HookConversationEntry[] = [];

  if (!data || typeof data !== "object") {
    return { messages, toolCalls, conversation, agentState: {} };
  }

  const raw = data as {
    messages?: Array<{
      id?: string;
      role?: string;
      content?: string;
      toolCalls?: Array<{
        toolCallId?: string;
        toolName?: string;
        args?: string;
        result?: string;
      }>;
    }>;
    state?: Record<string, unknown>;
    subagentTraces?: Record<string, unknown[]>;
  };

  const rawMessages = Array.isArray(raw.messages) ? raw.messages : [];
  const subagentTraces = raw.subagentTraces || {};
  const agentState = typeof raw.state === "object" && raw.state !== null ? raw.state : {};

  rawMessages.forEach((msg, idx) => {
    if (!msg) return;
    const role = msg.role === "user" ? "user" : "assistant";
    const content = typeof msg.content === "string" ? msg.content : "";
    const msgId = msg.id || `${role}-${idx}-${Date.now()}`;

    if (role === "user") {
      messages.push({
        id: msgId,
        role: "user",
        content,
        timestamp: Date.now(),
      });
      conversation.push({ id: `entry-${msgId}`, type: "message", refId: msgId });
    } else {
      if (Array.isArray(msg.toolCalls)) {
        msg.toolCalls.forEach((tc) => {
          if (!tc) return;
          const tcId = tc.toolCallId || `tool-${Math.random().toString(16).slice(2)}`;
          const tcName = tc.toolName || "tool";
          const argsText = typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args || {});
          const resultText = typeof tc.result === "string" ? tc.result : "";

          toolCalls.push({
            id: tcId,
            name: tcName,
            argumentsText: argsText,
            resultText,
            status: "completed",
            subEvents: Array.isArray(subagentTraces[tcId])
              ? (subagentTraces[tcId] as HookToolCall["subEvents"])
              : undefined,
          });
          conversation.push({ id: `entry-${tcId}`, type: "tool", refId: tcId });
        });
      }

      if (content || !msg.toolCalls?.length) {
        messages.push({
          id: msgId,
          role: "assistant",
          content,
          timestamp: Date.now(),
        });
        conversation.push({ id: `entry-${msgId}`, type: "message", refId: msgId });
      }
    }
  });

  return { messages, toolCalls, conversation, agentState };
}

export interface ThreadHistoryData {
  messages: HookChatMessage[];
  toolCalls: HookToolCall[];
  conversation: HookConversationEntry[];
  agentState: Record<string, unknown>;
}

/**
 * Fetches a thread's past messages + checkpoint state before a chat surface
 * mounts, so it can resume with real history instead of starting blank.
 * Shared by `agent-chat.tsx`'s top-level `AgentChat` and `architect-chat.tsx`'s
 * top-level `ArchitectChat` — both call `getProjectAgentThreadMessages` with
 * their own `agentId` (a real Agent id, or the Architect's sentinel id) and
 * get back the identical `{messages, state, subagentTraces}` shape.
 */
export function useThreadHistory(
  projectId: string,
  agentId: string,
  threadId: string | undefined
): { loadingHistory: boolean; initialData: ThreadHistoryData | null } {
  const [initialData, setInitialData] = React.useState<ThreadHistoryData | null>(null);
  const [loadingHistory, setLoadingHistory] = React.useState(Boolean(threadId));

  React.useEffect(() => {
    if (!threadId) {
      setInitialData(null);
      setLoadingHistory(false);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    getProjectAgentThreadMessages(projectId, agentId, threadId)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        setInitialData(normalizeCheckpointData(data));
      })
      .catch((err) => {
        console.error("Failed to load thread messages:", err);
        if (!cancelled) setInitialData(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, agentId, threadId]);

  return { loadingHistory, initialData };
}
