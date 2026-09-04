/**
 * useAguiChat — universal SSE client hook for the AG-UI protocol.
 *
 * Canonical version that powers both the agent-marketplace and BeyondCampus
 * frontends. Uses EventType enums from @ag-ui/client with string fallbacks
 * for backward compatibility.
 *
 * Features:
 * - All standard AG-UI events (text, reasoning, tools, lifecycle)
 * - HITL approval / clarification flows (hitl_request, clarification_request)
 * - UI blocks (ui_block) with tool call ID tracking
 * - Subagent activity timeline (subagent_activity)
 * - MCP App widget rendering (mcp_app)
 * - STATE_SNAPSHOT / MESSAGES_SNAPSHOT for agent state sync
 * - rAF-batched event processing (~60 renders/s cap)
 * - Auth-agnostic (accepts optional getToken + headers)
 * - Thread lifecycle callbacks (onThreadCreated, onRunFinished, onTitleGenerated)
 * - uiBlockToolCallIds for suppressing duplicate tool cards
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventType } from "@ag-ui/client";

// ─── Public Types ────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "reasoning" | "block";
  content: string;
  timestamp: number;
  blocks?: ChatUIBlock[];
  /** Wall-clock ms the reasoning block streamed, stamped when it closes. */
  durationMs?: number;
}

export interface ChatUIBlock {
  id: string;
  toolCallId?: string;
  block: string;
  props: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  argumentsText: string;
  resultText: string;
  status: "running" | "completed";
  subEvents?: SubEvent[];
  mcpApp?: { resourceUri: string; mcpId: string };
  structuredResult?: unknown;
}

export interface SubEvent {
  type: "text" | "tool";
  text?: string;
  name?: string;
  argsText?: string;
  resultText?: string;
  status?: string;
}

export interface ConversationEntry {
  id: string;
  type: "message" | "tool";
  refId: string;
}

export interface ApprovalRequest {
  actionRequests: Array<{
    type: string;
    label: string;
    [key: string]: unknown;
  }>;
  reviewConfigs: Array<Record<string, unknown>>;
}

export interface ClarificationRequest {
  questions: ClarificationQuestion[];
  currentIndex: number;
  answers: ClarificationAnswer[];
}

export interface ClarificationQuestion {
  id: string;
  text: string;
  options: string[];
  required: boolean;
  allowCustom: boolean;
}

export interface ClarificationAnswer {
  questionId: string;
  question: string;
  answer: string;
  optionIndex: number | null;
  freeform: boolean;
  skipped: boolean;
}

export interface UseAguiChatOptions {
  url?: string;
  agentId?: string;
  threadId?: string;
  initialMessages?:
    | ChatMessage[]
    | {
        messages?: ChatMessage[];
        conversation?: ConversationEntry[];
        toolCalls?: ToolCall[];
      };
  initialToolCalls?: ToolCall[];
  initialConversation?: ConversationEntry[];
  headers?: Record<string, string>;
  /** Async function that returns an auth token. Used by Clerk-based projects. */
  getToken?: () => Promise<string | null>;
  onToolResult?: (tool: ToolCall) => void;
  /** Lazy-create a persisted thread for the virtual `new` id (Persona). */
  onCreateThread?: () => Promise<string | undefined | null>;
  /** Called when a draft's server thread ID is available. BeyondCampus uses this to bind thread → localStorage. */
  onThreadCreated?: (threadId: string) => void;
  onRunFinished?: () => void;
  onTitleGenerated?: (title: string) => void;
}

export interface UseAguiChatReturn {
  messages: ChatMessage[];
  toolCalls: ToolCall[];
  conversation: ConversationEntry[];
  agentState: Record<string, unknown>;
  isRunning: boolean;
  isReasoning: boolean;
  error: string | null;
  threadId: string | undefined;
  pendingApproval: ApprovalRequest | null;
  pendingClarification: ClarificationRequest | null;
  /** Tool call IDs whose visual output is already rendered as UI blocks. */
  uiBlockToolCallIds: string[];
  send: (text: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
  respondToApproval: (
    decisions: Array<{ type: string; message?: string }>,
    options?: { displayText?: string },
  ) => Promise<void>;
  respondToClarification: (answer?: {
    answer?: string;
    optionIndex?: number | null;
    freeform?: boolean;
    skipped?: boolean;
  }) => Promise<void>;
}

// ─── Internal Types ──────────────────────────────────────────────────────────

interface InternalState {
  isParsedHistory: boolean;
  initialMessages: ChatMessage[];
  initialToolCalls: ToolCall[];
  initialConversation: ConversationEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseJsonMaybe(value: string | unknown): unknown {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (typeof part === "string" ? part : part?.text || ""))
    .join("");
}

function replaceById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((x) => x.id === item.id);
  if (index === -1) return [...items, item];
  return items.map((x, i) => (i === index ? item : x));
}

function ensureConversationEntry(
  entries: ConversationEntry[],
  type: ConversationEntry["type"],
  refId: string,
): ConversationEntry[] {
  if (entries.some((e) => e.type === type && e.refId === refId)) return entries;
  return [...entries, { id: id(`entry-${type}`), type, refId }];
}

function todosFromToolArgs(
  name: string,
  argsText: string,
): Array<{ content: string; status: string }> | null {
  if (!name || !name.toLowerCase().includes("todo")) return null;
  const parsed = parseJsonMaybe(argsText);
  if (!Array.isArray(parsed?.todos)) return null;
  return parsed.todos
    .map((todo: unknown) => ({
      content:
        typeof (todo as Record<string, unknown>)?.content === "string"
          ? ((todo as Record<string, unknown>).content as string)
          : "",
      status:
        typeof (todo as Record<string, unknown>)?.status === "string"
          ? ((todo as Record<string, unknown>).status as string)
          : "pending",
    }))
    .filter((todo) => todo.content);
}

function applyFileToolToState(
  state: Record<string, unknown>,
  name: string,
  argsText: string,
  resultText: string,
): Record<string, unknown> | null {
  const tool = String(name || "").toLowerCase();
  if (tool !== "write_file" && tool !== "edit_file") return null;
  if (typeof resultText === "string" && /^\s*error/i.test(resultText))
    return null;

  const args = parseJsonMaybe(argsText) as Record<string, unknown> | null;
  const path =
    typeof args?.file_path === "string"
      ? (args.file_path as string)
      : (args?.path as string);
  if (typeof path !== "string" || !path || path.startsWith("/skills/"))
    return null;

  const files = { ...((state?.files as Record<string, unknown>) || {}) };
  const now = new Date().toISOString();

  if (tool === "write_file") {
    if (typeof args?.content !== "string") return null;
    files[path] = {
      content: args.content,
      size: (args.content as string).length,
      created_at: (files[path] as Record<string, unknown>)?.created_at ?? now,
      modified_at: now,
    };
  } else {
    const prev = files[path] as Record<string, unknown> | undefined;
    if (
      !prev ||
      typeof prev.content !== "string" ||
      typeof args?.old_string !== "string"
    )
      return null;
    const replacement =
      typeof args.new_string === "string" ? (args.new_string as string) : "";
    const content = args.replace_all
      ? (prev.content as string)
          .split(args.old_string as string)
          .join(replacement)
      : (prev.content as string).replace(
          args.old_string as string,
          replacement,
        );
    files[path] = { ...prev, content, size: content.length, modified_at: now };
  }

  return { ...state, files };
}

function appendSubEvent(
  current: SubEvent[] | undefined,
  kind: string,
  value: Record<string, unknown>,
): SubEvent[] | null {
  const subEvents: SubEvent[] = Array.isArray(current) ? [...current] : [];

  if (kind === "text" || kind === undefined) {
    const delta =
      typeof value?.delta === "string" ? (value.delta as string) : "";
    if (!delta) return null;
    const last = subEvents[subEvents.length - 1];
    if (last?.type === "text") {
      subEvents[subEvents.length - 1] = {
        ...last,
        text: `${last.text}${delta}`,
      };
    } else {
      subEvents.push({ type: "text", text: delta });
    }
  } else if (kind === "tool_start") {
    subEvents.push({
      type: "tool",
      name: (value?.toolName as string) || "tool",
      argsText: typeof value?.args === "string" ? (value.args as string) : "",
      resultText: "",
      status: "running",
    });
  } else if (kind === "tool_result") {
    let matched = false;
    for (let i = subEvents.length - 1; i >= 0; i -= 1) {
      const item = subEvents[i];
      if (
        item.type === "tool" &&
        item.status === "running" &&
        item.name === value?.toolName
      ) {
        subEvents[i] = {
          ...item,
          resultText:
            typeof value?.result === "string" ? (value.result as string) : "",
          status: "completed",
        };
        matched = true;
        break;
      }
    }
    if (!matched) return null;
  } else {
    return null;
  }

  return subEvents;
}

function settleSubEvents(
  subEvents: SubEvent[] | undefined,
): SubEvent[] | undefined {
  if (!Array.isArray(subEvents)) return subEvents;
  if (
    !subEvents.some((item) => item.type === "tool" && item.status === "running")
  )
    return subEvents;
  return subEvents.map((item) =>
    item.type === "tool" && item.status === "running"
      ? { ...item, status: "completed" }
      : item,
  );
}

// Stamp every still-open reasoning block with its stream duration. The
// backend sends a bare REASONING_END (no messageId) and only ever keeps one
// reasoning block open, so duration is simply now minus the block's start
// timestamp (set when REASONING_MESSAGE_START arrived). Returns the original
// array untouched when nothing is open, avoiding a pointless re-render.
function stampReasoningFinished(
  messages: ChatMessage[],
  finishedAt: number,
): ChatMessage[] {
  let changed = false;
  const next = messages.map((m) => {
    if (m.role === "reasoning" && m.durationMs === undefined) {
      changed = true;
      return { ...m, durationMs: Math.max(0, finishedAt - m.timestamp) };
    }
    return m;
  });
  return changed ? next : messages;
}

function normalizeClarificationQuestions(
  questions: unknown,
): ClarificationQuestion[] {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((q: unknown, index: number) => {
      const question = q as Record<string, unknown>;
      const text =
        typeof question?.text === "string"
          ? (question.text as string).trim()
          : "";
      if (!text) return null;
      const options = Array.isArray(question.options)
        ? (question.options as Array<unknown>)
            .map((opt) => (typeof opt === "string" ? opt.trim() : ""))
            .filter(Boolean)
        : [];
      return {
        id:
          typeof question.id === "string" && (question.id as string).trim()
            ? (question.id as string).trim()
            : `question_${index + 1}`,
        text,
        options,
        required: question.required !== false,
        allowCustom: question.allowCustom !== false,
      };
    })
    .filter(Boolean) as ClarificationQuestion[];
}

function buildClarificationTranscript(answers: ClarificationAnswer[]): string {
  return answers
    .map((answer) => {
      const value = answer.skipped ? "Skipped" : answer.answer || "";
      return `Q: ${answer.question}\nA: ${value}`;
    })
    .join("\n\n");
}

function parseInitialState(
  initialMessages: UseAguiChatOptions["initialMessages"],
  initialToolCalls?: ToolCall[],
  initialConversation?: ConversationEntry[],
): InternalState {
  const isParsedHistory = !!(
    initialMessages &&
    !Array.isArray(initialMessages) &&
    typeof initialMessages === "object"
  );
  const parsed = isParsedHistory
    ? (initialMessages as {
        messages?: ChatMessage[];
        conversation?: ConversationEntry[];
        toolCalls?: ToolCall[];
      })
    : null;

  return {
    isParsedHistory,
    initialMessages:
      parsed?.messages ||
      (Array.isArray(initialMessages) ? initialMessages : []),
    initialToolCalls: parsed?.toolCalls || initialToolCalls || [],
    initialConversation: parsed?.conversation || initialConversation || [],
  };
}

function matchType(type: string, ...options: string[]): boolean {
  return options.some((opt) => type === opt);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAguiChat(
  options: UseAguiChatOptions = {},
): UseAguiChatReturn {
  const {
    url = "",
    agentId,
    threadId: externalThreadId,
    initialMessages: rawInitialMessages,
    initialToolCalls: rawInitialToolCalls,
    initialConversation: rawInitialConversation,
    headers,
    getToken,
    onToolResult,
    onCreateThread,
    onThreadCreated,
    onRunFinished,
    onTitleGenerated,
  } = options;

  // ── Parse initial state ──
  const initialState = useMemo(
    () =>
      parseInitialState(
        rawInitialMessages,
        rawInitialToolCalls,
        rawInitialConversation,
      ),
    // Only re-parse when threadId changes (new conversation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [externalThreadId],
  );

  const [messages, setMessages] = useState<ChatMessage[]>(
    initialState.initialMessages,
  );
  const [toolCalls, setToolCalls] = useState<ToolCall[]>(
    initialState.initialToolCalls,
  );
  const [conversation, setConversation] = useState<ConversationEntry[]>(
    initialState.initialConversation.length > 0
      ? initialState.initialConversation
      : initialState.initialMessages.map((m) => ({
          id: id("entry-message"),
          type: "message" as const,
          refId: m.id,
        })),
  );
  const [agentState, setAgentState] = useState<Record<string, unknown>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | undefined>(
    externalThreadId,
  );
  const [pendingApproval, setPendingApproval] =
    useState<ApprovalRequest | null>(null);
  const [pendingClarification, setPendingClarification] =
    useState<ClarificationRequest | null>(null);

  // Refs
  const messagesRef = useRef(messages);
  const abortRef = useRef<AbortController | null>(null);
  const toolNameRef = useRef(new Map<string, string>());
  const uiBlockToolCallIdsRef = useRef(new Set<string>());
  const suppressClarificationNoticeRef = useRef(false);
  const promotingRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Reset when external threadId changes (new conversation selected)
  useEffect(() => {
    const parsed = parseInitialState(
      rawInitialMessages,
      rawInitialToolCalls,
      rawInitialConversation,
    );
    setMessages(parsed.initialMessages);
    setToolCalls(parsed.initialToolCalls);
    setConversation(
      parsed.initialConversation.length > 0
        ? parsed.initialConversation
        : parsed.initialMessages.map((m) => ({
            id: id("entry-message"),
            type: "message" as const,
            refId: m.id,
          })),
    );
    setAgentState({});
    setError(null);
    setThreadId(externalThreadId);
    setPendingApproval(null);
    setPendingClarification(null);
    uiBlockToolCallIdsRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalThreadId]);

  const headerEntries = useMemo(
    () =>
      Object.entries(headers || {}).filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      ),
    [headers],
  );

  // ── State helpers ──
  const upsertMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => replaceById(prev, message));
    setConversation((prev) =>
      ensureConversationEntry(prev, "message", message.id),
    );
  }, []);

  const upsertTool = useCallback((tool: ToolCall) => {
    setToolCalls((prev) => replaceById(prev, tool));
    setConversation((prev) => ensureConversationEntry(prev, "tool", tool.id));
  }, []);

  const settleRunningTools = useCallback(() => {
    setToolCalls((prev) =>
      prev.some((t) => t.status === "running")
        ? prev.map((t) =>
            t.status === "running"
              ? {
                  ...t,
                  status: "completed" as const,
                  subEvents: settleSubEvents(t.subEvents),
                }
              : t,
          )
        : prev,
    );
  }, []);

  // ── rAF event batching ──
  const eventQueueRef = useRef<Array<Record<string, unknown>>>([]);
  const flushScheduledRef = useRef(false);

  const applyEvent = useCallback(
    (event: Record<string, unknown>) => {
      const type = event.type as string;

      // ── Lifecycle ──
      if (matchType(type, EventType.RUN_STARTED, "RUN_STARTED")) {
        setIsRunning(true);
        setError(null);
        return;
      }

      if (matchType(type, EventType.RUN_FINISHED, "RUN_FINISHED")) {
        setIsRunning(false);
        setIsReasoning(false);
        settleRunningTools();
        // An aborted run never sends REASONING_END — close out any block
        // still open so it still reports its duration.
        setMessages((prev) => stampReasoningFinished(prev, Date.now()));
        // Bind thread on first send (draft → server thread)
        if (event.threadId && !threadId) {
          const newId = event.threadId as string;
          setThreadId(newId);
          if (onThreadCreated) onThreadCreated(newId);
        }
        if (onRunFinished) onRunFinished();
        return;
      }

      if (matchType(type, EventType.RUN_ERROR, "RUN_ERROR")) {
        setIsRunning(false);
        setIsReasoning(false);
        settleRunningTools();
        setMessages((prev) => stampReasoningFinished(prev, Date.now()));
        setError(
          (event.message as string) || "The agent stopped unexpectedly.",
        );
        if (onRunFinished) onRunFinished();
        return;
      }

      // ── Text messages ──
      if (matchType(type, EventType.TEXT_MESSAGE_START, "TEXT_MESSAGE_START")) {
        upsertMessage({
          id: event.messageId as string,
          role: (event.role as ChatMessage["role"]) || "assistant",
          content: "",
          timestamp: Date.now(),
        });
        return;
      }

      if (
        matchType(
          type,
          EventType.TEXT_MESSAGE_CONTENT,
          EventType.TEXT_MESSAGE_CHUNK,
          "TEXT_MESSAGE_CONTENT",
          "TEXT_MESSAGE_CHUNK",
          "text",
        )
      ) {
        if (suppressClarificationNoticeRef.current) {
          suppressClarificationNoticeRef.current = false;
          return;
        }
        const messageId = (event.messageId as string) || id("assistant");
        const delta = (event.delta ?? event.content ?? "") as string;
        setMessages((prev) => {
          const current = prev.find((m) => m.id === messageId) || {
            id: messageId,
            role: "assistant" as const,
            content: "",
            timestamp: Date.now(),
          };
          return replaceById(prev, {
            ...current,
            content: `${current.content}${delta}`,
          });
        });
        setConversation((prev) =>
          ensureConversationEntry(prev, "message", messageId),
        );
        return;
      }

      // ── Reasoning ──
      if (
        matchType(
          type,
          EventType.REASONING_MESSAGE_START,
          "REASONING_MESSAGE_START",
        )
      ) {
        setIsReasoning(true);
        upsertMessage({
          id: (event.messageId as string) || id("reasoning"),
          role: "reasoning",
          content: "",
          timestamp: Date.now(),
        });
        return;
      }

      if (
        matchType(
          type,
          EventType.REASONING_MESSAGE_CONTENT,
          EventType.REASONING_MESSAGE_CHUNK,
          "REASONING_MESSAGE_CONTENT",
          "REASONING_MESSAGE_CHUNK",
        )
      ) {
        const messageId = (event.messageId as string) || id("reasoning");
        const delta = (event.delta ?? "") as string;
        setMessages((prev) => {
          const current = prev.find((m) => m.id === messageId) || {
            id: messageId,
            role: "reasoning" as const,
            content: "",
            timestamp: Date.now(),
          };
          return replaceById(prev, {
            ...current,
            content: `${current.content}${delta}`,
          });
        });
        setConversation((prev) =>
          ensureConversationEntry(prev, "message", messageId),
        );
        return;
      }

      if (matchType(type, EventType.REASONING_END, "REASONING_END")) {
        setIsReasoning(false);
        setMessages((prev) => stampReasoningFinished(prev, Date.now()));
        return;
      }

      // ── Tool calls ──
      if (matchType(type, EventType.TOOL_CALL_START, "TOOL_CALL_START")) {
        toolNameRef.current.set(
          event.toolCallId as string,
          event.toolCallName as string,
        );
        upsertTool({
          id: event.toolCallId as string,
          name: (event.toolCallName as string) || "tool",
          argumentsText: "",
          resultText: "",
          status: "running",
        });
        return;
      }

      if (
        matchType(
          type,
          EventType.TOOL_CALL_ARGS,
          EventType.TOOL_CALL_CHUNK,
          "TOOL_CALL_ARGS",
          "TOOL_CALL_CHUNK",
          "tool_call",
        )
      ) {
        const toolCallId = (event.toolCallId ??
          event.run_id ??
          id("tool")) as string;
        const toolName = (event.toolCallName ??
          event.name ??
          toolNameRef.current.get(toolCallId) ??
          "tool") as string;
        const delta = (event.delta ?? event.args ?? "") as string;

        toolNameRef.current.set(toolCallId, toolName);
        setToolCalls((prev) => {
          const existing = prev.find((t) => t.id === toolCallId);
          if (existing?.status === "completed") return prev;
          const current = existing || {
            id: toolCallId,
            name: toolName,
            argumentsText: "",
            resultText: "",
            status: "running" as const,
          };
          return replaceById(prev, {
            ...current,
            name: toolName,
            argumentsText: `${current.argumentsText}${delta}`,
            status: "running" as const,
          });
        });
        setConversation((prev) =>
          ensureConversationEntry(prev, "tool", toolCallId),
        );
        return;
      }

      if (matchType(type, EventType.TOOL_CALL_END, "TOOL_CALL_END")) {
        setToolCalls((prev) =>
          prev.map((tool) => {
            if (tool.id !== event.toolCallId) return tool;
            const todos = todosFromToolArgs(tool.name, tool.argumentsText);
            if (todos) setAgentState((state) => ({ ...state, todos }));
            return { ...tool, status: "completed" as const };
          }),
        );
        return;
      }

      if (
        matchType(
          type,
          EventType.TOOL_CALL_RESULT,
          "TOOL_CALL_RESULT",
          "tool_result",
        )
      ) {
        const toolCallId = (event.toolCallId ?? event.run_id) as string;
        const resultText = (event.content ?? event.result ?? "") as string;

        setToolCalls((prev) => {
          const current = prev.find((t) => t.id === toolCallId) || {
            id: toolCallId,
            name: toolNameRef.current.get(toolCallId) || "tool",
            argumentsText: "",
            resultText: "",
            status: "running" as const,
          };
          const completedTool: ToolCall = {
            ...current,
            resultText,
            status: "completed",
            subEvents: settleSubEvents(current.subEvents),
            ...(event.structuredContent !== undefined
              ? { structuredResult: event.structuredContent }
              : {}),
          };
          if (onToolResult) onToolResult(completedTool);
          setAgentState((state) => {
            let next = state;
            const todos = todosFromToolArgs(
              completedTool.name,
              completedTool.argumentsText,
            );
            if (todos) next = { ...next, todos };
            const withFiles = applyFileToolToState(
              next,
              completedTool.name,
              completedTool.argumentsText,
              resultText,
            );
            return withFiles || next;
          });
          return replaceById(prev, completedTool);
        });
        return;
      }

      // ── CUSTOM events (routing hub) ──
      if (matchType(type, EventType.CUSTOM, "CUSTOM")) {
        switch (event.name as string) {
          case "ui_block": {
            const value = event.value as Record<string, unknown>;
            const blockEntry: ChatUIBlock = {
              id: (value.id as string) || crypto.randomUUID(),
              toolCallId: value.toolCallId as string | undefined,
              block: value.block as string,
              props: (value.props ?? {}) as Record<string, unknown>,
            };
            if (blockEntry.toolCallId) {
              uiBlockToolCallIdsRef.current.add(blockEntry.toolCallId);
            }
            setMessages((prev) => [
              ...prev,
              {
                id: blockEntry.id,
                role: "block" as const,
                content: "",
                timestamp: Date.now(),
                blocks: [blockEntry],
              },
            ]);
            setConversation((prev) =>
              ensureConversationEntry(prev, "message", blockEntry.id),
            );
            return;
          }

          case "hitl_request": {
            if (
              Array.isArray(
                event.value &&
                  (event.value as Record<string, unknown>).actionRequests,
              )
            ) {
              setPendingClarification(null);
              setPendingApproval({
                actionRequests: (event.value as Record<string, unknown>)
                  .actionRequests as ApprovalRequest["actionRequests"],
                reviewConfigs:
                  ((event.value as Record<string, unknown>)
                    .reviewConfigs as Array<Record<string, unknown>>) || [],
              });
            }
            return;
          }

          case "clarification_request": {
            const questions = normalizeClarificationQuestions(
              (event.value as Record<string, unknown>)?.questions,
            );
            if (questions.length > 0) {
              setPendingApproval(null);
              setPendingClarification({
                questions,
                currentIndex: Number.isInteger(
                  (event.value as Record<string, unknown>)?.currentIndex,
                )
                  ? ((event.value as Record<string, unknown>)
                      .currentIndex as number)
                  : 0,
                answers: [],
              });
              suppressClarificationNoticeRef.current = true;
            }
            return;
          }

          case "subagent_activity": {
            const val = event.value as Record<string, unknown> | undefined;
            const toolCallId = val?.toolCallId as string | undefined;
            if (toolCallId) {
              setToolCalls((prev) =>
                prev.map((tool) => {
                  if (tool.id !== toolCallId) return tool;
                  const subEvents = appendSubEvent(
                    tool.subEvents,
                    val?.kind as string,
                    val || {},
                  );
                  return subEvents ? { ...tool, subEvents } : tool;
                }),
              );
            }
            return;
          }

          case "mcp_app": {
            const val = event.value as Record<string, unknown> | undefined;
            const mcpToolCallId = val?.toolCallId as string | undefined;
            const resourceUri = val?.resourceUri as string | undefined;
            const mcpId = val?.mcpId as string | undefined;
            if (mcpToolCallId && resourceUri && mcpId) {
              setToolCalls((prev) =>
                prev.map((tool) =>
                  tool.id === mcpToolCallId
                    ? { ...tool, mcpApp: { resourceUri, mcpId } }
                    : tool,
                ),
              );
            }
            return;
          }
        }
        return;
      }

      // ── State snapshot ──
      if (matchType(type, EventType.STATE_SNAPSHOT, "STATE_SNAPSHOT")) {
        setAgentState((event.snapshot as Record<string, unknown>) || {});
        return;
      }

      // ── Messages snapshot ──
      if (matchType(type, EventType.MESSAGES_SNAPSHOT, "MESSAGES_SNAPSHOT")) {
        const nextMessages = Array.isArray(event.messages)
          ? (event.messages as Array<Record<string, unknown>>).map((msg) => ({
              id: (msg.id as string) || id("message"),
              role: ((msg.role as string) ||
                "assistant") as ChatMessage["role"],
              content: contentToText(msg.content),
              timestamp: Date.now(),
            }))
          : [];
        setMessages(nextMessages);
        setConversation(
          nextMessages.map((msg) => ({
            id: id("entry-message"),
            type: "message" as const,
            refId: msg.id,
          })),
        );
        return;
      }

      // ── Title ──
      if (matchType(type, "title", EventType.TITLE || "TITLE")) {
        const title = event.title as string | undefined;
        if (onTitleGenerated && title) {
          onTitleGenerated(title);
        }
        return;
      }
    },
    [
      onToolResult,
      onThreadCreated,
      onRunFinished,
      onTitleGenerated,
      settleRunningTools,
      upsertMessage,
      upsertTool,
      threadId,
    ],
  );

  const applyEventRef = useRef(applyEvent);
  useEffect(() => {
    applyEventRef.current = applyEvent;
  }, [applyEvent]);

  const flushEvents = useCallback(() => {
    flushScheduledRef.current = false;
    const queue = eventQueueRef.current;
    if (queue.length === 0) return;
    eventQueueRef.current = [];
    for (const event of queue) applyEventRef.current(event);
  }, []);

  const enqueueEvent = useCallback(
    (event: Record<string, unknown>) => {
      eventQueueRef.current.push(event);
      if (flushScheduledRef.current) return;
      flushScheduledRef.current = true;
      if (typeof requestAnimationFrame === "function" && !document.hidden) {
        requestAnimationFrame(flushEvents);
      } else {
        setTimeout(flushEvents, 32);
      }
    },
    [flushEvents],
  );

  // ── SSE streaming ──
  const runStream = useCallback(
    async ({
      messages: bodyMessages,
      resume,
      threadIdOverride,
    }: {
      messages: ChatMessage[];
      resume?: Record<string, unknown>;
      threadIdOverride?: string;
    }) => {
      setError(null);
      setIsRunning(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // `threadIdOverride` is the source of truth when set: `null` means
        // "explicitly no thread" (virtual `new` without a creator), a string
        // means the newly created thread. Otherwise fall back to the prop,
        // treating the sentinel `"new"` as no thread.
        const resolvedExternal =
          externalThreadId === "new" ? undefined : externalThreadId;
        const activeThreadId =
          threadIdOverride !== undefined
            ? threadIdOverride || undefined
            : resolvedExternal;
        const authHeader: Record<string, string> = {};

        if (getToken) {
          const token = await getToken();
          if (token) {
            authHeader.Authorization = `Bearer ${token}`;
          }
        }

        // `headerEntries` may still carry a stale `X-Thread-Id: new` from the
        // parent's `headers` prop (run/page.jsx always sets it). Strip it when
        // there is no real thread so the fallback header below is authoritative.
        const baseHeaderEntries = Object.fromEntries(headerEntries);
        if (!activeThreadId) delete baseHeaderEntries["X-Thread-Id"];

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...baseHeaderEntries,
            ...authHeader,
            ...(activeThreadId ? { "X-Thread-Id": activeThreadId } : {}),
          },
          body: JSON.stringify({
            ...(activeThreadId ? { threadId: activeThreadId } : {}),
            runId: id("run"),
            agentId,
            messages: bodyMessages.map((msg) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
            })),
            ...(resume ? { resume } : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Agent request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const packets = buffer.split(/\n\n/);
          buffer = packets.pop() || "";

          for (const packet of packets) {
            const data = packet
              .split(/\n/)
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim())
              .join("\n");
            if (!data || data === "[DONE]") continue;
            const parsed = parseJsonMaybe(data);
            if (parsed) enqueueEvent(parsed as Record<string, unknown>);
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "Streaming failed.");
        }
      } finally {
        flushEvents();
        setIsRunning(false);
        setIsReasoning(false);
        abortRef.current = null;
      }
    },
    [
      agentId,
      enqueueEvent,
      flushEvents,
      getToken,
      headerEntries,
      url,
      externalThreadId,
    ],
  );

  // ── Public API ──
  const appendUserMessage = useCallback((content: string): ChatMessage[] => {
    const userMessage: ChatMessage = {
      id: id("user"),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    const nextMessages = [...messagesRef.current, userMessage];
    setMessages(nextMessages);
    setConversation((prev) =>
      ensureConversationEntry(prev, "message", userMessage.id),
    );
    return nextMessages;
  }, []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || !url || isRunning) return;

      // A typed reply while an approval is pending = reject-with-feedback
      if (pendingApproval) {
        const decisions = pendingApproval.actionRequests.map(() => ({
          type: "reject",
          message: content,
        }));
        await respondToApproval(decisions, { displayText: content });
        return;
      }

      if (pendingClarification) {
        await respondToClarification({ answer: content, freeform: true });
        return;
      }

      const nextMessages = appendUserMessage(content);

      let threadIdOverride: string | null | undefined;
      if (externalThreadId === "new") {
        if (onCreateThread) {
          promotingRef.current = true;
          try {
            const newId = await onCreateThread();
            if (newId) {
              setThreadId(newId);
              if (onThreadCreated) onThreadCreated(newId);
              threadIdOverride = newId;
            } else {
              // Creator returned nothing — send without a thread header and
              // let the backend fall back to deterministic langGraph id.
              threadIdOverride = null;
            }
          } catch (err) {
            // Creation failed — surface it and do not attempt the run.
            setError(
              (err as Error)?.message || "Failed to create conversation.",
            );
            return;
          }
        } else {
          // No lazy creator (e.g. preview): send without a thread header.
          threadIdOverride = null;
        }
      }

      await runStream({ messages: nextMessages, threadIdOverride });
    },
    [
      appendUserMessage,
      isRunning,
      onCreateThread,
      onThreadCreated,
      pendingApproval,
      pendingClarification,
      runStream,
      url,
      externalThreadId,
    ],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
    setIsReasoning(false);
  }, []);

  const clear = useCallback(() => {
    stop();
    setMessages([]);
    setConversation([]);
    setToolCalls([]);
    setAgentState({});
    setError(null);
    setPendingApproval(null);
    setPendingClarification(null);
    uiBlockToolCallIdsRef.current.clear();
  }, [stop]);

  // ── HITL ──
  const respondToApproval = useCallback(
    async (
      decisions: Array<{ type: string; message?: string }>,
      { displayText }: { displayText?: string } = {},
    ) => {
      if (!pendingApproval || !url || isRunning) return;
      if (!Array.isArray(decisions) || decisions.length === 0) return;

      setPendingApproval(null);
      const nextMessages = displayText
        ? appendUserMessage(displayText)
        : messagesRef.current;
      await runStream({ messages: nextMessages, resume: { decisions } });
    },
    [appendUserMessage, isRunning, pendingApproval, runStream, url],
  );

  const respondToClarification = useCallback(
    async ({
      answer = "",
      optionIndex = null,
      freeform = false,
      skipped = false,
    }: {
      answer?: string;
      optionIndex?: number | null;
      freeform?: boolean;
      skipped?: boolean;
    } = {}) => {
      if (!pendingClarification || !url || isRunning) return;

      const currentIndex = pendingClarification.currentIndex || 0;
      const question = pendingClarification.questions[currentIndex];
      if (!question) return;

      const normalizedAnswer = skipped ? "" : String(answer || "").trim();
      if (!skipped && !normalizedAnswer) return;

      const nextAnswer: ClarificationAnswer = {
        questionId: question.id,
        question: question.text,
        answer: normalizedAnswer,
        optionIndex: Number.isInteger(optionIndex) ? optionIndex : null,
        freeform: Boolean(freeform),
        skipped: Boolean(skipped),
      };
      const nextAnswers = [...pendingClarification.answers, nextAnswer];
      const nextIndex = currentIndex + 1;

      if (nextIndex < pendingClarification.questions.length) {
        setPendingClarification({
          ...pendingClarification,
          currentIndex: nextIndex,
          answers: nextAnswers,
        });
        return;
      }

      const text = buildClarificationTranscript(nextAnswers);
      setPendingClarification(null);
      const nextMessages = appendUserMessage(text);
      await runStream({
        messages: nextMessages,
        resume: { answers: nextAnswers, text },
      });
    },
    [appendUserMessage, isRunning, pendingClarification, runStream, url],
  );

  // ── Derived state ──
  const uiBlockToolCallIds = useMemo(
    () => Array.from(uiBlockToolCallIdsRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toolCalls],
  );

  return {
    messages,
    toolCalls,
    conversation,
    agentState,
    isRunning,
    isReasoning,
    error,
    threadId,
    pendingApproval,
    pendingClarification,
    uiBlockToolCallIds,
    send,
    stop,
    clear,
    respondToApproval,
    respondToClarification,
  };
}
