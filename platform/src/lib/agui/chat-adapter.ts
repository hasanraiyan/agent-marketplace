/**
 * chat-adapter — folds `useAguiChat` state into the render shapes the
 * `@/components/chat` library consumes.
 *
 * The chat components only ever render `ChatMessageData`/`ChatToolCall` rows
 * (see components/chat/types.ts); the hook speaks AG-UI in a different
 * vocabulary — interleaved `messages[]` (user/assistant/reasoning/block),
 * `toolCalls[]` with running|completed status, and an ordered
 * `conversation[]` of {type:"message"|"tool", refId} entries. This module is
 * the boundary between the two (the components' own type comment delegates
 * that job to "whatever hook parses AG-UI").
 *
 * Shape decisions:
 * - One assistant row per user turn. A turn's tool calls render above its
 *   text (the components have no interleaved timeline), which matches the
 *   standard flow: user → tool cards → final answer.
 * - `reasoning` messages surface on the assistant row as `reasoning[]` blocks
 *   (see components/chat/types.ts) so the model's visible thinking streams in
 *   above the tool trace / answer — matching the old dashboard's ReasoningBubble.
 *   A reasoning block is flagged `isStreaming` while the run is live and the
 *   backend has not stamped its `durationMs` yet (no REASONING_END seen).
 * - `block` messages are dropped from display.
 * - Subagent timelines are best-effort from a `task` tool's subEvents
 *   (coalesced text deltas → assistant lines). Absent when there is nothing
 *   clean to show, which simply hides the "View subagent" affordance.
 */

import type {
  ChatMessage as HookChatMessage,
  ToolCall as HookToolCall,
  ConversationEntry,
} from "@/lib/agui/use-agui-chat";
import type {
  ChatMessageData,
  ChatTodo,
  ChatToolCall,
  ChatReasoning,
  ChatInterruptData,
  ChatHitlAction,
  ChatClarificationQuestion,
} from "@/components/chat/types";
import { humanizeToolName } from "@/components/chat/tool-call-card";

/** One user turn → a user row (optional) + one assistant row with tools. */
export interface ChatTurn {
  key: string;
  userMessage?: ChatMessageData;
  assistantMessage: ChatMessageData;
  /** The plan a `write_todos` in this turn wrote (parsed from its args). */
  todos: ChatTodo[];
}

export interface ChatView {
  turns: ChatTurn[];
  /** id → ChatToolCall across every turn (for opening the subagent sheet). */
  toolCallsById: Map<string, ChatToolCall>;
}

export interface ChatAdapterInput {
  messages: HookChatMessage[];
  toolCalls: HookToolCall[];
  conversation: ConversationEntry[];
  isRunning: boolean;
}

// ─── Todo parsing (mirrors the hook's todosFromToolArgs status vocabulary) ──

function mapTodoStatus(status: unknown): ChatTodo["status"] {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "done") return "completed";
  if (s.includes("progress") || s === "running") return "in_progress";
  return "pending";
}

/** Parse `args.todos` into ChatTodo[] — null when the args hold none. */
function todosFromArgs(argsText: string): ChatTodo[] | null {
  if (!argsText) return null;
  let parsed: { todos?: unknown[] } | null = null;
  try {
    parsed = JSON.parse(argsText) as { todos?: unknown[] } | null;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed?.todos)) return null;
  const todos = parsed.todos
    .map((raw) => {
      const todo = (raw ?? {}) as { content?: unknown; title?: unknown; status?: unknown };
      const content =
        typeof todo.content === "string"
          ? todo.content
          : typeof todo.title === "string"
            ? todo.title
            : "";
      return content ? { content, status: mapTodoStatus(todo.status) } : null;
    })
    .filter((t): t is ChatTodo => t !== null);
  return todos.length ? todos : null;
}

// ─── Subagent timeline (best-effort, `task` tool only) ──────────────────────

function subagentMessagesFor(tool: HookToolCall): ChatMessageData[] | undefined {
  if (tool.name !== "task") return undefined;
  const texts = (tool.subEvents ?? [])
    .filter((se) => se.type === "text" && typeof se.text === "string" && se.text.trim())
    .map((se) => (se.text as string).trim());
  if (texts.length === 0) return undefined;
  return texts.map((text, i) => ({
    id: `${tool.id}-sub-${i}`,
    role: "assistant" as const,
    content: text,
  }));
}

function mapToolCall(tool: HookToolCall): ChatToolCall {
  return {
    id: tool.id,
    name: tool.name,
    args: tool.argumentsText || undefined,
    result: tool.resultText || undefined,
    status: tool.status === "running" ? ("running" as const) : ("done" as const),
    subagentMessages: subagentMessagesFor(tool),
    mcpApp: tool.mcpApp,
  };
}

// ─── Turn assembly ──────────────────────────────────────────────────────────

interface TurnDraft {
  key: string;
  user?: HookChatMessage;
  /** Assistant text segments in arrival order (ids stable for streaming). */
  assistantParts: Array<{ id: string; content: string }>;
  /** Reasoning-message ids in arrival order (one block per id). */
  reasoningOrder: string[];
  /** Tool calls by id, first-appearance order preserved. */
  toolOrder: string[];
  toolsById: Map<string, HookToolCall>;
}

export function toChatView(input: ChatAdapterInput): ChatView {
  const { messages, toolCalls, conversation, isRunning } = input;
  const msgById = new Map<string, HookChatMessage>();
  for (const msg of messages) msgById.set(msg.id, msg);
  const toolById = new Map<string, HookToolCall>();
  for (const tool of toolCalls) toolById.set(tool.id, tool);

  const drafts: TurnDraft[] = [];
  let current: TurnDraft | null = null;

  const openTurn = (user?: HookChatMessage): TurnDraft => {
    const turn: TurnDraft = {
      key: user ? user.id : `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      user,
      assistantParts: [],
      reasoningOrder: [],
      toolOrder: [],
      toolsById: new Map(),
    };
    drafts.push(turn);
    return turn;
  };

  const addTool = (turn: TurnDraft, tool: HookToolCall) => {
    if (turn.toolsById.has(tool.id)) return;
    turn.toolsById.set(tool.id, tool);
    turn.toolOrder.push(tool.id);
  };

  const addReasoning = (turn: TurnDraft, msg: HookChatMessage) => {
    if (!turn.reasoningOrder.includes(msg.id)) turn.reasoningOrder.push(msg.id);
  };

  for (const entry of conversation) {
    if (entry.type === "message") {
      const msg = msgById.get(entry.refId);
      if (!msg) continue;
      if (msg.role === "user") {
        current = openTurn(msg);
      } else if (msg.role === "assistant") {
        if (!current) current = openTurn();
        // Coalesce streamed text into one assistant part per message id so a
        // streaming message's row id stays stable across delta updates.
        const last = current.assistantParts[current.assistantParts.length - 1];
        if (last && last.id === msg.id) last.content += msg.content;
        else current.assistantParts.push({ id: msg.id, content: msg.content });
      } else if (msg.role === "reasoning") {
        // The model's visible thinking — carried through to the assistant row
        // so the ReasoningBlock component can render it (old dashboard parity).
        if (!current) current = openTurn();
        addReasoning(current, msg);
      }
      // block messages are intentionally not shown.
    } else if (entry.type === "tool") {
      const tool = toolById.get(entry.refId);
      if (!tool) continue;
      if (!current) current = openTurn();
      addTool(current, tool);
    }
  }

  const turns: ChatTurn[] = drafts.map((draft, index) => {
    const lastTurn = index === drafts.length - 1;

    const toolCalls = draft.toolOrder
      .map((id) => {
        const tool = draft.toolsById.get(id);
        return tool ? mapToolCall(tool) : null;
      })
      .filter((tc): tc is ChatToolCall => tc !== null);

    const hasTools = toolCalls.length > 0;
    const content = draft.assistantParts.map((p) => p.content).join("\n");

    // Empty-assistant turn only counts as "thinking" when it is the open tail
    // turn of a live run; a finished empty turn just renders nothing.
    const isStreaming = lastTurn && isRunning;

    const assistantId =
      draft.assistantParts[0]?.id ?? `${draft.key}::assistant`;

    // Reasoning blocks stream in alongside assistant text. Each maps straight
    // from a `role:"reasoning"` message; msgById holds its accumulated content
    // for this render. A block is only "live" when the run is still going AND
    // the backend has not yet stamped its end time (REASONING_END / RUN_END).
    const reasoningBlocks: ChatReasoning[] = draft.reasoningOrder
      .map((id) => msgById.get(id))
      .filter((m): m is HookChatMessage => !!m && m.role === "reasoning")
      .map((m) => ({
        id: m.id,
        content: m.content,
        isStreaming:
          lastTurn &&
          isRunning &&
          typeof (m as { durationMs?: number }).durationMs !== "number",
        startedAt: m.timestamp,
        durationMs: (m as { durationMs?: number }).durationMs,
      }))
      // Drop blocks that never produced tokens and have closed (a START with no
      // content would have no conversation entry anyway; guard against stray
      // empties so a finished "Thinking" ghost never renders).
      .filter(
        (r) => r.isStreaming || !!r.content?.trim()
      );

    const todos: ChatTodo[] = [];
    for (let i = draft.toolOrder.length - 1; i >= 0; i -= 1) {
      const tool = draft.toolsById.get(draft.toolOrder[i]);
      if (!tool) continue;
      const parsed = todosFromArgs(tool.argumentsText);
      if (parsed) {
        todos.push(...parsed);
        break; // the most recent write_todos in the turn is the plan to show
      }
    }

    const assistantMessage: ChatMessageData = {
      id: assistantId,
      role: "assistant",
      content,
      isStreaming,
      toolCalls: hasTools ? toolCalls : undefined,
      reasoning: reasoningBlocks.length ? reasoningBlocks : undefined,
    };

    const turn: ChatTurn = {
      key: draft.key,
      todos,
      assistantMessage,
    };
    if (draft.user) {
      turn.userMessage = {
        id: draft.user.id,
        role: "user",
        content: draft.user.content,
      };
    }
    return turn;
  });

  const toolCallsById = new Map<string, ChatToolCall>();
  for (const turn of turns) {
    for (const tc of turn.assistantMessage.toolCalls ?? []) {
      toolCallsById.set(tc.id, tc);
    }
  }

  return { turns, toolCallsById };
}

// ─── Interrupt shaping ──────────────────────────────────────────────────────

/**
 * Maps a live approval request onto the per-action HITL render shape.
 *
 * The backend's actionRequests come straight from langchain's
 * HumanInTheLoopMiddleware (`{ name, args, description }` — see
 * createActionAndConfig in langchain/dist/agents/middleware/hitl.js), not
 * `{ type, label }`. Surfacing `name` + `args` here (instead of dropping them)
 * is what lets the panel show which tool call is pending and with what
 * arguments, the same way ToolCallCard shows a completed call's Input.
 */
export function hitlInterruptFrom(
  approval: {
    actionRequests: Array<{ name: string; args?: unknown; description?: string }>;
  },
): ChatInterruptData {
  const actionRequests: ChatHitlAction[] = approval.actionRequests.map(
    (action, index) => ({
      // Positional id — decisions are answered whole-request, in order, so the
      // index is the only stable handle back to the request.
      id: String(index),
      label: action.name ? humanizeToolName(action.name) : "This action",
      toolName: action.name || "tool",
      args:
        action.args && typeof action.args === "object"
          ? JSON.stringify(action.args)
          : undefined,
    }),
  );
  return { kind: "hitl", actionRequests };
}

/**
 * Maps a live clarification request onto a render shape. The hook answers ONE
 * question at a time (currentIndex) even though the backend may ask several,
 * so this exposes only the current question — the InterruptPanel wizard then
 * steps once per submit and the hook advances currentIndex underneath.
 */
export function clarificationInterruptFrom(clarification: {
  questions: Array<{
    id: string;
    text: string;
    options: string[];
    required: boolean;
    allowCustom: boolean;
  }>;
  currentIndex: number;
}): ChatInterruptData {
  const current = clarification.questions[clarification.currentIndex || 0];
  const questions: ChatClarificationQuestion[] = current
    ? [
        {
          id: current.id,
          question: current.text,
          options: (current.options ?? []).map((o) => ({ value: o, label: o })),
          allowCustom: current.allowCustom,
          required: current.required !== false,
        },
      ]
    : [];
  return { kind: "clarification", questions };
}

/** Finds the SubagentSheet messages for an open tool call id (if any). */
export function subagentMessagesForToolId(
  view: ChatView,
  toolCallId: string,
): ChatMessageData[] | undefined {
  return view.toolCallsById.get(toolCallId)?.subagentMessages;
}
