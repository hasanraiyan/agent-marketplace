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
import { subagentMessagesForToolId } from "@/lib/agui/chat-adapter";
import {
  ChatScroller,
  ChatScrollerItem,
  ChatMessage,
  ChatComposer,
  ChatEmptyState,
  InterruptPanel,
  SubagentSheet,
  type ChatMessageData,
  type ChatToolCall,
} from "@/components/chat";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { createProjectAgentThread } from "@/lib/api/projects";
import { useAguiChatUI, useClerkGetToken } from "./use-chat-ui";
import { useThreadHistory } from "./use-thread-history";

/**
 * Live text-chat for one Agent — runs `useAguiChat` against the backend's
 * `test/agui` SSE endpoint and folds its AG-UI state into the render shapes
 * the chat component library consumes (see lib/agui/chat-adapter.ts). Shares
 * the interrupt-handling/transcript logic with `ArchitectChat` via
 * `useAguiChatUI` (see use-chat-ui.ts) — this component only adds its own
 * extra: workspace-file/tool-call bubbling for the Files/Terminal panels and
 * the subagent sheet, none of which the Architect has.
 */
function AgentChatInner({
  projectId,
  agentId,
  threadId,
  initialMessages,
  initialAgentState,
  onToolCallsChange,
  onOpenFile,
  onWorkspaceFilesChange,
  onTitleGenerated,
  onThreadPromoted,
}: {
  projectId: string;
  agentId: string;
  threadId?: string;
  initialMessages?: {
    messages: HookChatMessage[];
    toolCalls: HookToolCall[];
    conversation: HookConversationEntry[];
  };
  initialAgentState?: Record<string, unknown>;
  /** Bubbles the live, deduped tool-call list up for the Terminal panel — fires on every change. */
  onToolCallsChange?: (toolCalls: ChatToolCall[]) => void;
  /** present_file's card Open button — bubbles the path up instead of showing it in a local Sheet. */
  onOpenFile?: (path: string) => void;
  /** Bubbles the live agent filesystem up (for the Files sidebar to show real, current content) — fires on every change. */
  onWorkspaceFilesChange?: (
    files: Record<string, { content: string; size: number; createdAt: string | null; modifiedAt: string | null }>
  ) => void;
  /** Fires when AG-UI emits an auto-generated thread title. */
  onTitleGenerated?: (title: string) => void;
  /** Fires once the draft ("new") thread is lazily promoted to a real one by
   * the first send — see use-thread-history.ts's DRAFT_THREAD_ID. */
  onThreadPromoted?: (threadId: string) => void;
}) {
  const url = React.useMemo(
    () =>
      `${api.defaults.baseURL ?? "/api/v1"}/projects/${projectId}/agents/${agentId}/test/agui`,
    [projectId, agentId]
  );
  const getToken = useClerkGetToken();

  // Owned internally (seeded once from the `threadId` prop) — see the
  // identical comment in architect-chat.tsx's ArchitectChatInner for why:
  // promoting a draft ("new") to its real id must never flow back down as a
  // prop change, or it'd force a remount via this component's own `key`
  // upstream, or retrigger useThreadHistory's fetch.
  const [liveThreadId, setLiveThreadId] = React.useState(threadId);

  const onCreateThread = React.useCallback(async () => {
    const res = await createProjectAgentThread(projectId, agentId);
    return res.data?.data?.threadId as string | undefined;
  }, [projectId, agentId]);

  const handleThreadCreated = React.useCallback(
    (newId: string) => {
      setLiveThreadId(newId);
      onThreadPromoted?.(newId);
    },
    [onThreadPromoted]
  );

  const chat = useAguiChat({
    url,
    agentId,
    threadId: liveThreadId,
    initialMessages,
    initialAgentState,
    onTitleGenerated,
    onCreateThread,
    onThreadCreated: handleThreadCreated,
    getToken,
  });

  const { send, stop } = chat;
  const { view, interrupt, interruptKey, handleDecideHitl, handleSubmitClarification } =
    useAguiChatUI(chat);

  React.useEffect(() => {
    onToolCallsChange?.(Array.from(view.toolCallsById.values()));
  }, [view.toolCallsById, onToolCallsChange]);

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

  const handleWidgetSendMessage = React.useCallback(
    async (text: string) => {
      try {
        await send(text);
      } catch {
        // errors surface through chat.error
      }
    },
    [send]
  );

  // ── Subagent sheet + workspace files (Files sidebar, not a local Sheet) ──
  const [openToolId, setOpenToolId] = React.useState<string | null>(null);

  const agentFiles = React.useMemo(() => {
    const files = chat.agentState?.files;
    return (files ?? {}) as Record<
      string,
      { content?: string; size?: number; created_at?: string | null; modified_at?: string | null }
    >;
  }, [chat.agentState]);

  React.useEffect(() => {
    if (!onWorkspaceFilesChange) return;
    const normalized: Record<
      string,
      { content: string; size: number; createdAt: string | null; modifiedAt: string | null }
    > = {};
    for (const [path, file] of Object.entries(agentFiles)) {
      normalized[path] = {
        content: file.content ?? "",
        size: file.size ?? 0,
        createdAt: file.created_at ?? null,
        modifiedAt: file.modified_at ?? null,
      };
    }
    onWorkspaceFilesChange(normalized);
  }, [agentFiles, onWorkspaceFilesChange]);

  const subagentMessages: ChatMessageData[] = React.useMemo(() => {
    if (!openToolId) return [];
    return subagentMessagesForToolId(view, openToolId) ?? [];
  }, [view, openToolId]);

  const hasTranscript = view.turns.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        {!hasTranscript ? (
          <ChatEmptyState
            title="Test your agent"
            description="This runs the agent live against its real tools and knowledge. Ask anything to start a thread."
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
                    <ChatMessage
                      message={a}
                      todos={turn.todos.length ? turn.todos : undefined}
                      projectId={projectId}
                      onOpenSubagent={setOpenToolId}
                      onOpenWorkspaceFile={onOpenFile}
                      onSendMessage={handleWidgetSendMessage}
                    />
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
            <AlertTitle>Agent run failed</AlertTitle>
            <AlertDescription>{chat.error}</AlertDescription>
          </Alert>
        )}

        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={stop}
          isStreaming={chat.isRunning}
          placeholder="Ask your agent…"
        />
      </div>

      <SubagentSheet
        open={!!openToolId}
        onOpenChange={(open) => {
          if (!open) setOpenToolId(null);
        }}
        messages={subagentMessages}
      />
    </div>
  );
}

/**
 * Top-level AgentChat component with conversation thread history support.
 * When `threadId` is supplied, fetches past messages and checkpoint state
 * before mounting the streaming chat interface (see use-thread-history.ts).
 */
function AgentChat({
  projectId,
  agentId,
  threadId,
  onToolCallsChange,
  onOpenFile,
  onWorkspaceFilesChange,
  onTitleGenerated,
  onThreadPromoted,
}: {
  projectId: string;
  agentId: string;
  threadId?: string;
  onToolCallsChange?: (toolCalls: ChatToolCall[]) => void;
  onOpenFile?: (path: string) => void;
  onWorkspaceFilesChange?: (
    files: Record<string, { content: string; size: number; createdAt: string | null; modifiedAt: string | null }>
  ) => void;
  /** Fires when AG-UI emits an auto-generated thread title. */
  onTitleGenerated?: (title: string) => void;
  onThreadPromoted?: (threadId: string) => void;
}) {
  const { loadingHistory, initialData } = useThreadHistory(projectId, agentId, threadId);

  if (loadingHistory) {
    return (
      <div className="flex h-full min-h-[350px] flex-col items-center justify-center p-8 text-muted-foreground gap-2.5">
        <SpinnerIcon className="size-6 animate-spin text-primary" />
        <span className="text-xs font-medium">Loading conversation history…</span>
      </div>
    );
  }

  return (
    <AgentChatInner
      key={`${agentId}-${threadId ?? "default"}`}
      projectId={projectId}
      agentId={agentId}
      threadId={threadId}
      initialMessages={initialData ?? undefined}
      initialAgentState={initialData?.agentState}
      onToolCallsChange={onToolCallsChange}
      onOpenFile={onOpenFile}
      onWorkspaceFilesChange={onWorkspaceFilesChange}
      onTitleGenerated={onTitleGenerated}
      onThreadPromoted={onThreadPromoted}
    />
  );
}

export { AgentChat };
