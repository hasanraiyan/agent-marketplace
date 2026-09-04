"use client";

import { useEffect, useRef, useState } from "react";
import {
  BotIcon,
  Brain,
  FileText,
  Globe,
  ListTodo,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Wrench,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAguiChat } from "@/lib/agui/use-agui-chat";
import { getSuggestedPrompts, tryParseJson, parseToolArgs } from "./utils";
import { MessageBubble, NewChatIcon } from "./MessageBubble";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ToolTrace } from "./ToolTrace";
import { MCPAppRenderer } from "@/components/mcp/mcp-app-renderer";
import { ApprovalCard, ClarificationCard } from "./ApprovalCard";
import { ChatComposer } from "./ChatComposer";
import { toast } from "sonner";

// Premium minds details removed

export function AguiAgentChat({
  agent,
  url,
  agentId,
  threadId,
  headers,
  initialMessages = [],
  initialState = {},
  title = "Sage",
  emptyTitle = "Sage",
  emptyDescription = "Tell me what you want to build, change, or explore.",
  className,
  onToolResult,
  onStateChange,
  onCreateThread,
  onNewChat,
  onRunFinished,
  onTitleGenerated,
  onOpenFile,
  showHeader = true,
  contentClassName,
  // 'profile' (default, unchanged): the full marketplace-agent-card empty
  // state below — avatar/share/social links/chat-count — built for a real
  // published Agent with real profile data. 'simple': a lightweight
  // icon+title+description+suggested-prompts placeholder for chats that
  // have no such profile to show (e.g. the Project Agent Architect, which
  // has no avatar/social links/chat history of its own). Purely additive —
  // every existing caller keeps the exact 'profile' rendering unchanged.
  emptyStateVariant = "profile",
}) {
  const [input, setInput] = useState("");
  const [resettingChat, setResettingChat] = useState(false);
  const scrollRef = useRef(null);
  const chat = useAguiChat({
    url,
    agentId,
    threadId,
    headers,
    initialMessages,
    initialState,
    onToolResult,
    onCreateThread,
    onRunFinished,
    onTitleGenerated,
  });

  const startNewChat = async () => {
    setInput("");
    if (!onNewChat) {
      chat.clear();
      return;
    }
    // Parent creates a fresh backend thread; local state resets when the
    // threadId prop changes. Fall back to a local clear only on failure.
    setResettingChat(true);
    try {
      await onNewChat();
    } catch (err) {
      console.error("Failed to start a new chat thread:", err);
      chat.clear();
    } finally {
      setResettingChat(false);
    }
  };

  useEffect(() => {
    onStateChange?.(chat.agentState);
  }, [chat.agentState, onStateChange]);

  useEffect(() => {
    if (!scrollRef.current || chat.conversation.length === 0) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });

  const send = () => {
    const text = input;
    setInput("");
    chat.send(text);
  };

  const messageById = (messageId) =>
    chat.messages.find((message) => message.id === messageId);
  const toolById = (toolId) =>
    chat.toolCalls.find((tool) => tool.id === toolId);

  // The live reasoning bubble (last reasoning message while streaming) renders
  // the animated ThinkingIndicator in its header; the footer indicator only
  // covers the tool-running phase when no reasoning is streaming.
  const liveReasoningId = chat.isReasoning
    ? [...chat.messages].reverse().find((m) => m.role === "reasoning")?.id
    : undefined;
  const showFooterThinking = chat.isRunning && !chat.isReasoning;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-white dark:bg-slate-950",
        className,
      )}
    >
      {showHeader ? (
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex size-8 items-center justify-center rounded-full bg-[#1E60FF]/10 text-[#1E60FF]">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-slate-950 dark:text-white">
              {title}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            onClick={startNewChat}
            disabled={resettingChat}
            title="New Chat"
          >
            {resettingChat ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <NewChatIcon className="size-4" />
            )}
          </Button>
        </div>
      ) : null}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `,
        }}
      />

      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-4 py-5",
          chat.conversation.length === 0 && "no-scrollbar",
        )}
      >
        {chat.conversation.length === 0 &&
        !chat.pendingApproval &&
        !chat.pendingClarification ? (
          emptyStateVariant === "simple" ? (
            <div
              className={cn(
                "mx-auto flex h-full w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center",
                contentClassName,
              )}
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[#1E60FF]/10 text-[#1E60FF]">
                <Sparkles className="size-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {emptyTitle}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {emptyDescription}
              </p>
              {getSuggestedPrompts(agent || { name: emptyTitle }).length >
                0 && (
                <div className="mt-3 flex w-full flex-col gap-2">
                  {getSuggestedPrompts(agent || { name: emptyTitle }).map(
                    (p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => chat.send(p.prompt)}
                        className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-left text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/80"
                      >
                        {p.title}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "mx-auto flex w-full max-w-4xl flex-col justify-start px-6 pt-2 pb-8 text-left bg-white dark:bg-slate-950",
                contentClassName,
              )}
            >
              {(() => {
                const details = {
                  tags: agent?.tags?.join(" | ") || agent?.category || "Agent",
                  mindCount: agent?.messageCount
                    ? `${agent.messageCount} Chats`
                    : "0 Chats",
                  verified: false,
                  description: [
                    agent?.description ||
                      "Ask this agent to work on your request.",
                  ],
                  prompts: getSuggestedPrompts(agent).map((p) => p.prompt),
                  socials: {
                    x: "https://x.com",
                    linkedin: "https://linkedin.com",
                    youtube: "https://youtube.com",
                  },
                };

                const handleShare = () => {
                  if (typeof window !== "undefined") {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success("Agent chat link copied!");
                  }
                };

                return (
                  <div className="flex flex-col items-start w-full">
                    {/* Top Row: Square Avatar + Share button */}
                    <div className="flex w-full items-start justify-between">
                      <div className="relative">
                        <img
                          src={agent?.avatarUrl || agent?.avatar}
                          alt={agent?.name || "Agent"}
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-[28px] sm:rounded-[36px] object-cover border border-slate-150/80 dark:border-slate-800"
                        />
                      </div>

                      <button
                        onClick={handleShare}
                        className="flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer select-none border border-slate-200 dark:border-slate-800"
                      >
                        <svg
                          className="size-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                        Share
                      </button>
                    </div>

                    {/* Name */}
                    <h1 className="text-3xl sm:text-4.5xl font-bold tracking-tight text-slate-900 dark:text-white mt-6">
                      {agent?.name || emptyTitle}
                    </h1>

                    {/* Meta Row: Verified Badge + Subtitle Tags + Mind Count */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-3 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                      {details.verified && (
                        <span
                          className="inline-flex text-[#1E60FF] shrink-0"
                          title="Verified Professional"
                        >
                          <svg
                            className="size-4.5 fill-current"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                          </svg>
                        </span>
                      )}
                      <span className="text-slate-700 dark:text-slate-350 font-bold">
                        {details.tags}
                      </span>
                      <span className="text-slate-300 dark:text-slate-800">
                        |
                      </span>
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500 font-bold">
                        <svg
                          className="size-4 fill-emerald-500"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                        <span>{details.mindCount}</span>
                      </div>
                    </div>

                    {/* Description Paragraphs */}
                    <div className="mt-4 text-slate-650 dark:text-slate-350 text-[14.5px] sm:text-[15.5px] leading-relaxed space-y-3 font-medium max-w-4xl">
                      {details.description.map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>

                    {/* Ask me about Card */}
                    <div className="bg-slate-50/80 dark:bg-slate-900/40 p-4 sm:p-5 rounded-3xl mt-5 w-full max-w-4xl border border-slate-100/60 dark:border-slate-900/60">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5 mb-4 select-none">
                        <svg
                          className="size-5 text-slate-805 dark:text-slate-200"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                        Ask me about
                      </h3>
                      <div className="flex flex-col gap-2.5 items-start">
                        {details.prompts.map((promptText, i) => (
                          <button
                            key={i}
                            onClick={() => chat.send(promptText)}
                            className="text-left bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 px-5 py-2.5 rounded-full text-xs sm:text-[13.5px] font-semibold border border-slate-200 dark:border-slate-850 cursor-pointer transition-colors"
                          >
                            {promptText}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Social Follow */}
                    <div className="mt-6">
                      <p className="text-[13px] font-bold text-slate-450 dark:text-slate-500 select-none">
                        Follow {agent?.name || "them"} for more...
                      </p>
                      <div className="flex items-center gap-2.5 mt-3.5">
                        <a
                          href={details.socials.x}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="size-9 rounded-full bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-850 flex items-center justify-center text-slate-800 dark:text-slate-200 transition-colors border border-transparent dark:border-slate-850"
                        >
                          <svg
                            className="size-4 fill-current"
                            viewBox="0 0 24 24"
                          >
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                        </a>
                        <a
                          href={details.socials.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="size-9 rounded-full bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-850 flex items-center justify-center text-slate-800 dark:text-slate-200 transition-colors border border-transparent dark:border-slate-850"
                        >
                          <svg
                            className="size-4.5 fill-current"
                            viewBox="0 0 24 24"
                          >
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                          </svg>
                        </a>
                        <a
                          href={details.socials.youtube}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="size-9 rounded-full bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-850 flex items-center justify-center text-slate-800 dark:text-slate-200 transition-colors border border-transparent dark:border-slate-850"
                        >
                          <svg
                            className="size-4.5 fill-current"
                            viewBox="0 0 24 24"
                          >
                            <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                          </svg>
                        </a>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-10 pt-4 border-t border-slate-100 dark:border-slate-900 w-full text-[11.5px] font-semibold text-slate-450 dark:text-slate-600 select-none">
                      © 2026 {agent?.name || "Agent"} • Terms • Privacy
                    </div>
                  </div>
                );
              })()}
            </div>
          )
        ) : (
          <div
            className={cn(
              "mx-auto w-full max-w-4xl space-y-4",
              contentClassName,
            )}
          >
            {(() => {
              const renderItems = [];
              let currentToolGroup = [];

              const flushToolGroup = () => {
                if (currentToolGroup.length > 0) {
                  renderItems.push({
                    type: "tool_group",
                    id: `group-${currentToolGroup[0].id}`,
                    tools: [...currentToolGroup],
                  });
                  currentToolGroup = [];
                }
              };

              chat.conversation.forEach((entry) => {
                if (entry.type === "message") {
                  flushToolGroup();
                  const message = messageById(entry.refId);
                  if (message) {
                    renderItems.push({
                      type: "message",
                      id: entry.id,
                      data: message,
                    });
                  }
                } else if (entry.type === "tool") {
                  const tool = toolById(entry.refId);
                  if (tool) {
                    const isPresentFile =
                      tool.name?.toLowerCase() === "present_file";
                    if (isPresentFile) {
                      flushToolGroup();
                      renderItems.push({
                        type: "present_file",
                        id: `present-${tool.id}`,
                        tool,
                      });
                    } else {
                      currentToolGroup.push(tool);
                      // MCP App widgets are a first-class part of the conversation,
                      // not a detail buried behind the "Used N tools" accordion -
                      // flush so it renders as its own always-visible block right
                      // where this tool call happened, not nested inside it.
                      if (tool.mcpApp?.resourceUri && tool.mcpApp?.mcpId) {
                        flushToolGroup();
                        renderItems.push({
                          type: "mcp_app",
                          id: `mcpapp-${tool.id}`,
                          tool,
                        });
                      }
                    }
                  }
                }
              });

              flushToolGroup();

              return renderItems.map((item, index) => {
                const prev = renderItems[index - 1];
                // The trace flows straight into the assistant text answering
                // it — no gap. A new user turn keeps its breathing room.
                const tightAfterTools =
                  (prev?.type === "tool_group" ||
                    prev?.type === "present_file") &&
                  item.type === "message" &&
                  item.data.role !== "user";

                let node = null;
                if (item.type === "message") {
                  node = (
                    <MessageBubble
                      message={item.data}
                      isStreaming={
                        item.data.role === "reasoning" &&
                        item.data.id === liveReasoningId
                      }
                    />
                  );
                } else if (item.type === "tool_group") {
                  // A lone tool reads as a plain step row — a one-item
                  // accordion is just noise.
                  node =
                    item.tools.length === 1 ? (
                      <ToolTrace tool={item.tools[0]} onOpenFile={onOpenFile} />
                    ) : (
                      <CollapsibleToolGroup
                        tools={item.tools}
                        onOpenFile={onOpenFile}
                      />
                    );
                } else if (item.type === "mcp_app") {
                  node = (
                    <MCPAppRenderer
                      mcpId={item.tool.mcpApp.mcpId}
                      resourceUri={item.tool.mcpApp.resourceUri}
                      toolName={item.tool.name}
                      tool={item.tool}
                      height={420}
                    />
                  );
                } else if (item.type === "present_file") {
                  node = <ToolTrace tool={item.tool} onOpenFile={onOpenFile} />;
                }
                if (!node) return null;
                return (
                  <div
                    key={item.id}
                    className={tightAfterTools ? "!mt-1" : undefined}
                  >
                    {node}
                  </div>
                );
              });
            })()}
            {chat.pendingApproval ? (
              <ApprovalCard
                approval={chat.pendingApproval}
                onRespond={chat.respondToApproval}
                disabled={chat.isRunning}
              />
            ) : null}
            {showFooterThinking ? (
              <div className="max-w-[92%] px-1 py-1.5">
                <ThinkingIndicator />
              </div>
            ) : null}
          </div>
        )}
      </div>

      {chat.error ? (
        <div
          className={cn(
            "mx-auto w-full max-w-4xl px-4 pb-2 text-sm text-red-500",
            contentClassName,
          )}
        >
          {chat.error}
        </div>
      ) : null}
      <div className="sticky bottom-0 z-10 shrink-0 bg-transparent px-4 pb-4 pt-3">
        <div
          className={cn("mx-auto w-full max-w-4xl space-y-2", contentClassName)}
        >
          {chat.pendingClarification ? (
            <ClarificationCard
              key={chat.pendingClarification.currentIndex}
              clarification={chat.pendingClarification}
              onRespond={chat.respondToClarification}
              disabled={chat.isRunning}
            />
          ) : null}
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={send}
            onStop={chat.stop}
            isRunning={chat.isRunning}
            disabled={!threadId || !url}
            placeholder={
              chat.pendingApproval
                ? "Reply with feedback, or use the buttons above..."
                : chat.pendingClarification
                  ? "Reply directly, or use the choices above..."
                  : "Write a message..."
            }
          />
        </div>
      </div>
    </div>
  );
}

// Which semantic family a tool belongs to, for the cluster header. Memory is
// detected by name AND by file ops touching /memories/ paths (Dostify-style).
function toolGroupKey(tool) {
  const name = (tool.name || "").toLowerCase();
  if (name.includes("memory") || name.includes("preference")) return "memory";
  const args = parseToolArgs(tool.argumentsText);
  const path = args?.file_path || args?.path || "";
  if (typeof path === "string" && path.includes("/memories")) return "memory";
  if (
    name.includes("file") ||
    name === "ls" ||
    name === "glob" ||
    name === "grep"
  )
    return "file";
  if (name.includes("search") || name.startsWith("tavily")) return "search";
  if (name === "task") return "task";
  if (name.includes("todo")) return "plan";
  return name;
}

const CLUSTER_META = {
  memory: { title: "Personalizing memory", Icon: Brain },
  file: { title: "Working with files", Icon: FileText },
  search: { title: "Searching the web", Icon: Globe },
  task: { title: "Running subagents", Icon: BotIcon },
  plan: { title: "Updating the plan", Icon: ListTodo },
  mixed: { title: "Performing actions", Icon: Wrench },
};

// A run of adjacent tool calls collapses into ONE cluster with a header
// derived from what the mix is doing — "Working with files", "Searching the
// web" — instead of a generic "Used N tools".
function clusterMeta(tools) {
  const groups = new Set(tools.map(toolGroupKey));
  const key = groups.size === 1 ? [...groups][0] : "mixed";
  return CLUSTER_META[key] || CLUSTER_META.mixed;
}

function CollapsibleToolGroup({ tools, onOpenFile }) {
  const hasError = tools.some((t) => {
    const parsed = tryParseJson(t.resultText);
    return parsed?.status === "error";
  });
  const anyRunning = tools.some((t) => t.status !== "completed");
  const { title, Icon: GroupIcon } = clusterMeta(tools);

  const [isOpen, setIsOpen] = useState(anyRunning);
  const [prevAnyRunning, setPrevAnyRunning] = useState(anyRunning);

  if (anyRunning && !prevAnyRunning) {
    setIsOpen(true);
    setPrevAnyRunning(anyRunning);
  } else if (!anyRunning && prevAnyRunning) {
    setPrevAnyRunning(anyRunning);
  }

  return (
    <div className="max-w-[92%] rounded-xl bg-transparent py-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-1 py-1.5 text-left text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <div className="flex items-center gap-2">
          {anyRunning ? (
            <Loader2 className="size-4 animate-spin text-orange-500" />
          ) : hasError ? (
            <AlertCircle className="size-4 text-red-500" />
          ) : (
            <CheckCircle2 className="size-4 text-emerald-500" />
          )}
          <GroupIcon className="size-4 text-slate-400 dark:text-slate-500" />
          <span className="font-bold">{title}</span>
          <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
            {tools.length} step{tools.length > 1 ? "s" : ""}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2 pl-4">
          {tools.map((tool) => (
            <ToolTrace key={tool.id} tool={tool} onOpenFile={onOpenFile} />
          ))}
        </div>
      )}
    </div>
  );
}
