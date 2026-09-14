"use client";

import * as React from "react";
import { SpinnerIcon } from "@phosphor-icons/react";
import { api } from "@/lib/api/core";
import {
  useAguiChat,
  type ChatMessage as HookChatMessage,
  type ToolCall as HookToolCall,
  type ConversationEntry as HookConversationEntry,
} from "@/lib/agui/use-agui-chat";
import {
  ChatScroller,
  ChatScrollerItem,
  ChatMessage,
  ChatComposer,
  ChatEmptyState,
  InterruptPanel,
} from "@/components/chat";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useAguiChatUI, useClerkGetToken } from "./use-chat-ui";
import { useThreadHistory } from "./use-thread-history";

// Sentinel whose dedicated "Project Agent Architect" graph the project-scoped
// /architect/agui route runs (agent-backend modules/agents/architectConstants.js
// PROJECT_ARCHITECT_AGENT_ID). It is not a real project Agent — it can't be
// picked from the project's agent list, only reached through the Architect
// endpoint — so it lives here as a constant rather than as list data. Exported
// so page.tsx can reuse the exact same id for the Threads sidebar and Memory
// workspace, which now both work against the Architect too.
export const PROJECT_ARCHITECT_AGENT_ID = "000000000000000000000001";

/**
 * "Just the chat" surface for the Project Agent Architect — the spec bot that
 * creates/edits a project's Agents by conversation via its consolidated
 * `manage_agent` CRUD tool (action: create/read/update/patch/delete).
 * Shares the interrupt-handling/transcript logic with `AgentChat` via
 * `useAguiChatUI` (see use-chat-ui.ts) — this component only adds its own
 * extra: the "refresh the agent picker on a successful mutation" effect
 * below, and its own (simpler) JSX (no workspace files / subagents / Voice
 * tab — voice sessions refuse any agent with guarded tools, and the
 * Architect's entire toolbox is guarded by design).
 *
 * The Architect now supports real per-thread history, same as a real Agent:
 * `threadId` selects which server-side Conversation/LangGraph thread to
 * resume (omit it for the original single deterministic `architect-<domain>`
 * conversation every existing session already resolves to).
 */
function ArchitectChatInner({
  projectId,
  threadId,
  initialMessages,
  initialAgentState,
  onAgentsRefreshed,
  onTitleGenerated,
}: {
  projectId: string;
  threadId?: string;
  initialMessages?: {
    messages: HookChatMessage[];
    toolCalls: HookToolCall[];
    conversation: HookConversationEntry[];
  };
  initialAgentState?: Record<string, unknown>;
  onAgentsRefreshed: () => void;
  onTitleGenerated?: (title: string) => void;
}) {
  const url = React.useMemo(
    () =>
      `${api.defaults.baseURL ?? "/api/v1"}/projects/${projectId}/architect/agui`,
    [projectId]
  );
  const getToken = useClerkGetToken();

  const chat = useAguiChat({
    url,
    agentId: PROJECT_ARCHITECT_AGENT_ID,
    threadId,
    initialMessages,
    initialAgentState,
    onTitleGenerated,
    getToken,
  });

  const { send, stop } = chat;
  const { view, interrupt, interruptKey, handleDecideHitl, handleSubmitClarification } =
    useAguiChatUI(chat);

  // ── Composer ────────────────────────────────────────────────────────────
  const [input, setInput] = React.useState("");
  const handleSend = React.useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    try {
      await send(text);
    } catch {
      // errors surface through chat.error
    }
  }, [input, send]);

  // ── Agent-list refresh on successful mutation ───────────────────────────
  // The Architect's mutations all flow through its consolidated manage_agent
  // tool (action: create/read/update/patch/delete); when a create/update/
  // patch/delete call reports {status:"success"} the parent re-fetches the
  // project's agents so the change appears in the picker (a plain "read"
  // never needs a refresh). Tracked per tool-call id so a single mutation
  // fires exactly one refresh (ids are run-local uuids, so the set never
  // needs clearing).
  const handledUpsertIds = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    for (const tc of chat.toolCalls) {
      if (tc.status !== "completed" || tc.name !== "manage_agent") continue;
      if (handledUpsertIds.current.has(tc.id)) continue;
      handledUpsertIds.current.add(tc.id);
      let succeeded = false;
      try {
        const args = JSON.parse(tc.argumentsText) as { action?: string };
        const parsed = JSON.parse(tc.resultText) as { status?: string };
        succeeded = parsed?.status === "success" && args?.action !== "read";
      } catch {
        succeeded = false;
      }
      if (succeeded) onAgentsRefreshed();
    }
  }, [chat.toolCalls, onAgentsRefreshed]);

  const hasTranscript = view.turns.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        {!hasTranscript ? (
          <ChatEmptyState
            title="Describe the agent you want"
            description="I'm the Agent Architect — describe what your agent should do and I'll create it (or update it) for you, wired to this project's tools and knowledge. The agents I make show up in the picker above, ready to test over chat or voice."
          />
        ) : (
          <ChatScroller>
            {view.turns.map((turn) => {
              const rows: React.ReactNode[] = [];
              if (turn.userMessage) {
                rows.push(
                  <ChatScrollerItem key={`${turn.key}-user`}>
                    <ChatMessage message={turn.userMessage} />
                  </ChatScrollerItem>
                );
              }
              const a = turn.assistantMessage;
              const hasVisual =
                !!a.content?.trim() ||
                !!a.isStreaming ||
                (a.reasoning?.length ?? 0) > 0 ||
                (a.toolCalls?.length ?? 0) > 0;
              if (hasVisual) {
                rows.push(
                  <ChatScrollerItem key={`${turn.key}-assistant`}>
                    <ChatMessage message={a} />
                  </ChatScrollerItem>
                );
              }
              return rows;
            })}
          </ChatScroller>
        )}
      </div>

      {/* px-4 matches ChatScroller's own message padding above, so the
          composer lines up with the message bubbles now that the page
          wrapper no longer adds its own horizontal padding on mobile. Bottom
          padding is capped to the safe-area inset (not a flat pb-4) so it
          doesn't carry extra dead space on top of that on a phone screen,
          while still clearing the home-indicator area. */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
        {interrupt && (
          <div className="mb-2">
            <InterruptPanel
              key={interruptKey}
              interrupt={interrupt}
              onSubmitClarification={handleSubmitClarification}
              onDecideHitl={handleDecideHitl}
            />
          </div>
        )}

        {chat.error && (
          <Alert variant="destructive" className="mb-2">
            <AlertTitle>Architect run failed</AlertTitle>
            <AlertDescription>{chat.error}</AlertDescription>
          </Alert>
        )}

        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={stop}
          isStreaming={chat.isRunning}
          placeholder="Describe an agent…"
        />
      </div>
    </div>
  );
}

/**
 * Top-level ArchitectChat with conversation thread history support — uses
 * the same `useThreadHistory` hook `AgentChat` does (see agent-chat.tsx):
 * fetch past messages, then mount.
 */
function ArchitectChat({
  projectId,
  threadId,
  onAgentsRefreshed,
  onTitleGenerated,
}: {
  projectId: string;
  threadId?: string;
  onAgentsRefreshed: () => void;
  onTitleGenerated?: (title: string) => void;
}) {
  const { loadingHistory, initialData } = useThreadHistory(
    projectId,
    PROJECT_ARCHITECT_AGENT_ID,
    threadId
  );

  if (loadingHistory) {
    return (
      <div className="flex h-full min-h-[350px] flex-col items-center justify-center p-8 text-muted-foreground gap-2.5">
        <SpinnerIcon className="size-6 animate-spin text-primary" />
        <span className="text-xs font-medium">Loading conversation history…</span>
      </div>
    );
  }

  return (
    <ArchitectChatInner
      key={threadId ?? "default"}
      projectId={projectId}
      threadId={threadId}
      initialMessages={initialData ?? undefined}
      initialAgentState={initialData?.agentState}
      onAgentsRefreshed={onAgentsRefreshed}
      onTitleGenerated={onTitleGenerated}
    />
  );
}

export { ArchitectChat };
