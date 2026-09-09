"use client";

import * as React from "react";
import { api } from "@/lib/api/core";
import { useAguiChat } from "@/lib/agui/use-agui-chat";
import {
  toChatView,
  hitlInterruptFrom,
  clarificationInterruptFrom,
  subagentMessagesForToolId,
} from "@/lib/agui/chat-adapter";
import {
  ChatScroller,
  ChatScrollerItem,
  ChatMessage,
  ChatComposer,
  ChatEmptyState,
  InterruptPanel,
  SubagentSheet,
  WorkspaceFilePanel,
  type ChatMessageData,
  type ChatWorkspaceFile,
  type ChatInterruptData,
} from "@/components/chat";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

/**
 * Live text-chat for one Agent — runs `useAguiChat` against the backend's
 * `test/agui` SSE endpoint and folds its AG-UI state into the render shapes
 * the chat component library consumes (see lib/agui/chat-adapter.ts).
 *
 * The parent remounts this via `key={agentId}`, so switching agents starts a
 * fresh local conversation (the component holds no history of its own).
 */
function AgentChat({
  projectId,
  agentId,
}: {
  projectId: string;
  agentId: string;
}) {
  const url = React.useMemo(
    () =>
      `${api.defaults.baseURL ?? "/api/v1"}/projects/${projectId}/agents/${agentId}/test/agui`,
    [projectId, agentId]
  );

  const chat = useAguiChat({
    url,
    agentId,
    getToken: React.useCallback(
      () =>
        typeof window !== "undefined"
          ? (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string> } } })
              .Clerk?.session?.getToken?.() ?? Promise.resolve(null)
          : Promise.resolve(null),
      []
    ),
  });

  const { send, stop, respondToApproval, respondToClarification } = chat;

  // chat.* are state arrays — stable references between commits — so the
  // adapter re-runs only when the underlying transcript/tool list moves.
  const view = React.useMemo(
    () =>
      toChatView({
        messages: chat.messages,
        toolCalls: chat.toolCalls,
        conversation: chat.conversation,
        isRunning: chat.isRunning,
      }),
    [chat.messages, chat.toolCalls, chat.conversation, chat.isRunning]
  );

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

  // ── Interrupts (HITL approval + clarification) ──────────────────────────
  const interrupt = React.useMemo<ChatInterruptData | null>(() => {
    if (chat.pendingApproval) return hitlInterruptFrom(chat.pendingApproval);
    if (chat.pendingClarification?.questions?.length) {
      return clarificationInterruptFrom(chat.pendingClarification);
    }
    return null;
  }, [chat.pendingApproval, chat.pendingClarification]);

  // HITL: the whole request is answered at once — buffer one decision per
  // action (keyed by its positional id), then fire them all together.
  const [hitlDecisions, setHitlDecisions] = React.useState<Record<string, "approve" | "reject">>({});
  const hitlFiredRef = React.useRef(false);
  React.useEffect(() => {
    setHitlDecisions({});
    hitlFiredRef.current = false;
  }, [chat.pendingApproval]);

  const handleDecideHitl = React.useCallback(
    (actionId: string, decision: "approve" | "reject") => {
      if (!chat.pendingApproval || hitlFiredRef.current) return;
      const next = { ...hitlDecisions, [actionId]: decision };
      setHitlDecisions(next);
      const { actionRequests } = chat.pendingApproval;
      const allDecided =
        actionRequests.length > 0 && actionRequests.every((_, i) => next[String(i)]);
      if (!allDecided) return;
      hitlFiredRef.current = true;
      void respondToApproval(
        actionRequests.map((_, i) =>
          next[String(i)] === "reject"
            ? { type: "reject", message: "Rejected by the developer." }
            : { type: "approve" }
        )
      );
    },
    [chat.pendingApproval, hitlDecisions, respondToApproval]
  );

  // Clarification: the hook answers ONE question at a time, so the panel shows
  // a single-question wizard slice; each submit answers only the current step.
  const [clarBusy, setClarBusy] = React.useState(false);
  React.useEffect(() => {
    setClarBusy(false);
  }, [chat.pendingClarification]);

  const handleSubmitClarification = React.useCallback(
    (answers: Record<string, string>) => {
      if (!chat.pendingClarification || clarBusy) return;
      const q =
        chat.pendingClarification.questions[chat.pendingClarification.currentIndex || 0];
      if (!q) return;
      const value = answers[q.id ?? `q-${chat.pendingClarification.currentIndex || 0}`];
      setClarBusy(true);
      if (value && value.trim()) {
        void respondToClarification({ answer: value.trim(), freeform: true });
      } else {
        void respondToClarification({ skipped: true });
      }
    },
    [chat.pendingClarification, clarBusy, respondToClarification]
  );

  const interruptKey = chat.pendingApproval
    ? "hitl"
    : `clar-${chat.pendingClarification?.currentIndex ?? 0}`;

  // ── Subagent sheet + workspace file panel ───────────────────────────────
  const [openToolId, setOpenToolId] = React.useState<string | null>(null);
  const [workspaceFile, setWorkspaceFile] = React.useState<ChatWorkspaceFile | null>(null);

  const agentFiles = React.useMemo(() => {
    const files = chat.agentState?.files;
    return (files ?? {}) as Record<string, { content?: string }>;
  }, [chat.agentState]);

  const handleOpenWorkspaceFile = React.useCallback(
    (path: string) => {
      setWorkspaceFile({
        path,
        title: path.split("/").pop() || path,
        content: agentFiles[path]?.content,
      });
    },
    [agentFiles]
  );

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
                      onOpenWorkspaceFile={handleOpenWorkspaceFile}
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

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
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
      <WorkspaceFilePanel
        file={workspaceFile}
        onOpenChange={(open) => {
          if (!open) setWorkspaceFile(null);
        }}
      />
    </div>
  );
}

export { AgentChat };
