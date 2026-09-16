"use client";

import * as React from "react";
import { FolderOpenIcon, PlusIcon, TerminalIcon, TrashIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatScroller, ChatScrollerItem } from "./chat-scroller";
import { ChatMessage } from "./chat-message";
import { ChatComposer } from "./chat-composer";
import { ChatEmptyState, type ChatStarterPrompt } from "./chat-empty-state";
import { Spinner } from "@/components/ui/spinner";
import { InterruptPanel } from "./interrupt-panel";
import { TodoChecklist } from "./todo-checklist";
import { SubagentSheet } from "./subagent-sheet";
import { MemoryWorkspaceDialog } from "./memory-workspace-dialog";
import { SandboxTerminalDialog } from "./sandbox-terminal-dialog";
import { VoiceIndicator } from "./voice-indicator";
import { flattenSubagentActivity } from "./message-grouping";
import { useAgents, type PersonaMessage, type PersonaStreamingEvent } from "@personaai/react";
import {
  usePersonaChatWidget,
  type UsePersonaChatWidgetOptions,
} from "./use-persona-chat-widget";

export interface PersonaChatViewClassNames {
  root?: string;
  threadList?: string;
  scroller?: string;
  composer?: string;
}

export interface PersonaMessageSlotProps {
  message: PersonaMessage;
  reasoningPhases?: PersonaMessage[];
  onOpenSubagent?: (toolCallId: string) => void;
  onOpenWorkspaceFile?: (path: string) => void;
  onSendMessage?: (text: string) => void;
}

export interface PersonaChatViewComponents {
  /** Replaces the whole per-message row (avatar/bubble/tool-trace/markdown). */
  Message?: React.ComponentType<PersonaMessageSlotProps>;
  /** Replaces the empty-conversation state. */
  EmptyState?: React.ComponentType<{
    title: string;
    description?: string;
    starterPrompts?: ChatStarterPrompt[];
    onSelectPrompt?: (template: string) => void;
  }>;
}

export interface PersonaChatViewProps extends UsePersonaChatWidgetOptions {
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  starterPrompts?: ChatStarterPrompt[];
  placeholder?: string;
  /** @default "sidebar-main" */
  layout?: "sidebar-main" | "stacked";
  /** @default true — ignored when layout is "stacked". */
  showThreadList?: boolean;
  /** @default true */
  showComposer?: boolean;
  /** Renders a "start voice call" button + the live voice-state orb. @default true */
  showVoice?: boolean;
  /** Renders a "Files" button that opens the active Agent's memory + workspace files (read/write/delete). @default true */
  showFiles?: boolean;
  /** Renders a "Terminal" button — only shown when the active Agent has `sandboxEnabled: true` — replaying its live `execute` tool calls. @default true */
  showTerminal?: boolean;
  /**
   * CSS custom properties that override this app's shadcn tokens for just
   * this view (`--primary`, `--radius`, `--background`, …) — every visual
   * surface underneath is already bound to these vars via Tailwind, so
   * theming never means forking a component.
   */
  theme?: React.CSSProperties;
  classNames?: PersonaChatViewClassNames;
  /** Slot overrides — each receives the same props the default component gets. */
  components?: PersonaChatViewComponents;
  /** Wrap or replace a message's default render without losing the default. */
  renderMessage?: (
    message: PersonaMessage,
    reasoningPhases: PersonaMessage[] | undefined,
    defaultRender: () => React.ReactNode
  ) => React.ReactNode;
  emptyState?: React.ReactNode;
  loadingState?: React.ReactNode;
  errorState?: React.ReactNode | ((error: Error) => React.ReactNode);
  /** Raw AG-UI event passthrough (tool calls, steps, subagent activity). */
  onEvent?: (event: PersonaStreamingEvent) => void;
  className?: string;
}

/**
 * Assembled chat widget — thread list + message feed + composer — built
 * entirely on `usePersonaChatWidget` (itself built on `@personaai/react`'s
 * `useChat`/`useThreads`/`useFiles`/`useVoice`). Every component underneath
 * (`ChatMessage`, `ChatComposer`, …) consumes `@personaai/react`'s own types
 * directly, no parallel vocabulary; this file is the SDK-first glue + the
 * configurability seams (`layout`, `theme`, `classNames`, `components`,
 * `render*`) on top of it.
 *
 * Throws (via `usePersonaContext`, called deep inside `useChat`) with a
 * clear message if rendered outside `<PersonaProvider baseUrl>`.
 */
export function PersonaChatView({
  agentId,
  threadId,
  onThreadChange,
  onEvent,
  title = "Assistant",
  emptyTitle = "How can I help?",
  emptyDescription,
  starterPrompts,
  placeholder,
  layout = "sidebar-main",
  showThreadList = true,
  showComposer = true,
  showVoice = true,
  showFiles = true,
  showTerminal = true,
  theme,
  classNames = {},
  components = {},
  renderMessage,
  emptyState,
  loadingState,
  errorState,
  className,
}: PersonaChatViewProps) {
  const {
    activeThreadId,
    threads,
    threadsLoading,
    handleSelectThread,
    handleNewChat,
    deleteThread,
    messages,
    input,
    setInput,
    isStreaming,
    isLoadingHistory,
    error,
    interrupt,
    todos,
    handleSend,
    handleDecideHitl,
    handleSubmitClarification,
    stop,
    openWorkspaceFile,
    presentedFile,
    dismissPresentedFile,
    sandboxCommands,
    voice,
    isVoiceActive,
  } = usePersonaChatWidget({ agentId, threadId, onThreadChange, onEvent, enableVoice: showVoice });

  const [openSubagentFor, setOpenSubagentFor] = React.useState<string | null>(null);
  const [filesOpen, setFilesOpen] = React.useState(false);
  const [terminalOpen, setTerminalOpen] = React.useState(false);
  const isFilesSheetOpen = filesOpen || !!presentedFile;
  // Workspace files are Agent-scoped, not Thread-scoped (shared across every
  // conversation with that Agent) — prefer the active thread's own agentId
  // (authoritative for which agent this conversation is actually with) over
  // the `agentId` prop, which only matters before any thread exists yet.
  const activeAgentId = React.useMemo(() => {
    const thread = threads.find((t) => t._id === activeThreadId);
    const threadAgentId = thread
      ? typeof thread.agentId === "string"
        ? thread.agentId
        : thread.agentId?._id
      : undefined;
    return threadAgentId || agentId;
  }, [threads, activeThreadId, agentId]);

  // Read-only discovery, always on — used only to check the active Agent's
  // own sandboxEnabled flag, so the Terminal button never shows for an
  // Agent that has no sandbox to replay.
  const { agents } = useAgents(showTerminal);
  const activeAgent = React.useMemo(
    () => agents.find((a) => a._id === activeAgentId),
    [agents, activeAgentId]
  );
  const canShowTerminal = showTerminal && !!activeAgent?.sandboxEnabled;
  const subagentMessages: PersonaMessage[] = React.useMemo(() => {
    if (!openSubagentFor) return [];
    for (const { message } of messages) {
      const call = message.toolCalls?.find((tc) => tc.toolCallId === openSubagentFor);
      if (call?.subagentActivity) return flattenSubagentActivity(call.toolCallId, call.subagentActivity);
    }
    return [];
  }, [messages, openSubagentFor]);

  const MessageComponent = components.Message;
  const EmptyStateComponent = components.EmptyState ?? ChatEmptyState;

  const renderOneMessage = (message: PersonaMessage, reasoningPhases: PersonaMessage[] | undefined) => {
    const defaultRender = () =>
      MessageComponent ? (
        <MessageComponent
          message={message}
          reasoningPhases={reasoningPhases}
          onOpenSubagent={setOpenSubagentFor}
          onOpenWorkspaceFile={openWorkspaceFile}
          onSendMessage={handleSend}
        />
      ) : (
        <ChatMessage
          message={message}
          reasoningPhases={reasoningPhases}
          todos={todos}
          onOpenSubagent={setOpenSubagentFor}
          onOpenWorkspaceFile={openWorkspaceFile}
          onSendMessage={handleSend}
        />
      );
    return renderMessage ? renderMessage(message, reasoningPhases, defaultRender) : defaultRender();
  };

  const showThreads = layout === "sidebar-main" && showThreadList;

  return (
    <div
      style={theme}
      className={cn(
        "flex h-full min-h-0 w-full overflow-hidden bg-background text-foreground",
        classNames.root,
        className
      )}
    >
      {showThreads && (
        <div
          className={cn(
            "flex w-64 shrink-0 flex-col border-r border-border bg-card",
            classNames.threadList
          )}
        >
          <div className="flex items-center justify-between border-b border-border p-2">
            <span className="px-1 text-sm font-semibold">{title}</span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="New chat" onClick={handleNewChat}>
              <PlusIcon />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-0.5 p-1.5">
              {threadsLoading && threads.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Loading…</div>
              )}
              {threads.map((t) => (
                <div key={t._id} className="group/thread flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSelectThread(t._id)}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                      activeThreadId === t._id && "bg-accent font-medium"
                    )}
                  >
                    {t.title || "New chat"}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete thread"
                    className="opacity-0 group-hover/thread:opacity-100"
                    onClick={() => void deleteThread(t._id)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {(showFiles || canShowTerminal) && (
          <div className="flex h-11 shrink-0 items-center justify-end gap-1 border-b border-border px-2">
            {showFiles && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Memory & workspace files"
                onClick={() => setFilesOpen(true)}
              >
                <FolderOpenIcon />
              </Button>
            )}
            {canShowTerminal && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Sandbox terminal"
                onClick={() => setTerminalOpen(true)}
              >
                <TerminalIcon />
              </Button>
            )}
          </div>
        )}
        {isLoadingHistory && messages.length === 0 ? (
          loadingState ?? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner className="size-5 text-muted-foreground" />
            </div>
          )
        ) : messages.length === 0 ? (
          emptyState ?? (
            <EmptyStateComponent
              title={emptyTitle}
              description={emptyDescription}
              starterPrompts={messages.length === 0 ? starterPrompts : undefined}
              onSelectPrompt={(template) => void handleSend(template)}
            />
          )
        ) : (
          <ChatScroller className={classNames.scroller}>
            {messages.map(({ message, reasoningPhases }) => (
              <ChatScrollerItem key={message.id}>
                {renderOneMessage(message, reasoningPhases)}
              </ChatScrollerItem>
            ))}
          </ChatScroller>
        )}

        {error &&
          (errorState ? (
            typeof errorState === "function" ? errorState(error) : errorState
          ) : (
            <div className="mx-auto mb-2 w-full max-w-3xl px-4 text-xs text-destructive">
              {error.message || "Failed to communicate with agent."}
            </div>
          ))}

        {interrupt && (
          <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-2">
            <InterruptPanel
              interrupt={interrupt}
              onDecideHitl={handleDecideHitl}
              onSubmitClarification={handleSubmitClarification}
            />
          </div>
        )}

        {todos.length > 0 && (
          <div className="mx-auto w-full max-w-3xl shrink-0 px-4">
            <TodoChecklist todos={todos} className="pb-2" />
          </div>
        )}

        {showComposer && (
          <div className={cn("mx-auto w-full max-w-3xl shrink-0 px-4 pb-4", classNames.composer)}>
            {/* Only occupies space while a call is actually live — the idle
                "start voice" control lives inside the composer's own send
                slot below, not as a separate row. */}
            {showVoice && isVoiceActive && (
              <div className="mb-2 flex items-center justify-center">
                <VoiceIndicator state={voice.state} size={40} />
              </div>
            )}
            <ChatComposer
              value={input}
              onChange={setInput}
              onSend={() => void handleSend()}
              onStop={stop}
              onStartVoice={showVoice ? () => void voice.start() : undefined}
              onStopVoice={voice.stop}
              onSendToVoice={voice.sendText}
              isStreaming={isStreaming}
              isVoiceActive={isVoiceActive}
              placeholder={placeholder}
            />
          </div>
        )}
      </div>

      <SubagentSheet
        open={openSubagentFor !== null}
        onOpenChange={(open) => !open && setOpenSubagentFor(null)}
        messages={subagentMessages}
      />

      {showFiles && (
        <MemoryWorkspaceDialog
          open={isFilesSheetOpen}
          onOpenChange={(open) => {
            setFilesOpen(open);
            if (!open) dismissPresentedFile();
          }}
          agentId={activeAgentId}
          initialOpenPath={presentedFile?.path}
        />
      )}

      {canShowTerminal && (
        <SandboxTerminalDialog
          open={terminalOpen}
          onOpenChange={setTerminalOpen}
          commands={sandboxCommands}
        />
      )}
    </div>
  );
}
