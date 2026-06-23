"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventType } from "@ag-ui/client";
import { useAuth } from "@clerk/nextjs";

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseJsonMaybe(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function contentToText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (typeof part === "string" ? part : part?.text || ""))
    .join("");
}

// Parse the todo list out of a completed `write_todos` tool call so the plan
// can update mid-run (the authoritative STATE_SNAPSHOT only arrives at end of
// turn). Returns null unless the args contain a well-formed todos array.
function todosFromToolArgs(name, argsText) {
  if (!name || !name.toLowerCase().includes("todo")) return null;
  const parsed = parseJsonMaybe(argsText);
  if (!Array.isArray(parsed?.todos)) return null;
  return parsed.todos
    .map((todo) => ({
      content: typeof todo?.content === "string" ? todo.content : "",
      status: typeof todo?.status === "string" ? todo.status : "pending",
    }))
    .filter((todo) => todo.content);
}

// Optimistically mirror a completed write_file / edit_file call into the
// shared agent state so the Files panel updates mid-run instead of waiting for
// the end-of-turn STATE_SNAPSHOT (which stays authoritative and reconciles).
// Returns the next state, or null when the call isn't a mirrorable file write.
function applyFileToolToState(state, name, argsText, resultText) {
  const tool = String(name || "").toLowerCase();
  if (tool !== "write_file" && tool !== "edit_file") return null;
  // A failed call didn't change the filesystem.
  if (typeof resultText === "string" && /^\s*error/i.test(resultText)) return null;

  const args = parseJsonMaybe(argsText);
  const path = typeof args?.file_path === "string" ? args.file_path : args?.path;
  if (typeof path !== "string" || !path || path.startsWith("/skills/")) return null;

  const files = { ...(state?.files || {}) };
  const now = new Date().toISOString();

  if (tool === "write_file") {
    if (typeof args?.content !== "string") return null;
    files[path] = {
      content: args.content,
      size: args.content.length,
      created_at: files[path]?.created_at ?? now,
      modified_at: now,
    };
  } else {
    const prev = files[path];
    if (!prev || typeof prev.content !== "string" || typeof args?.old_string !== "string") {
      return null;
    }
    const replacement = typeof args.new_string === "string" ? args.new_string : "";
    const content = args.replace_all
      ? prev.content.split(args.old_string).join(replacement)
      : prev.content.replace(args.old_string, replacement);
    files[path] = { ...prev, content, size: content.length, modified_at: now };
  }

  return { ...state, files };
}

// Fold one subagent_activity event into a task card's timeline. Items are
// { type: "text", text } or { type: "tool", name, argsText, resultText,
// status }. Returns the next array, or null when the event changes nothing.
function appendSubEvent(current, kind, value) {
  const subEvents = Array.isArray(current) ? [...current] : [];

  if (kind === "text" || kind === undefined) {
    const delta = typeof value?.delta === "string" ? value.delta : "";
    if (!delta) return null;
    const last = subEvents[subEvents.length - 1];
    if (last?.type === "text") {
      subEvents[subEvents.length - 1] = {
        ...last,
        text: `${last.text}${delta}`.slice(-4000),
      };
    } else {
      subEvents.push({ type: "text", text: delta });
    }
  } else if (kind === "tool_start") {
    subEvents.push({
      type: "tool",
      name: value?.toolName || "tool",
      argsText: typeof value?.args === "string" ? value.args : "",
      resultText: "",
      status: "running",
    });
  } else if (kind === "tool_result") {
    // Complete the most recent still-running call of this tool.
    let matched = false;
    for (let i = subEvents.length - 1; i >= 0; i -= 1) {
      const item = subEvents[i];
      if (item.type === "tool" && item.status === "running" && item.name === value?.toolName) {
        subEvents[i] = {
          ...item,
          resultText: typeof value?.result === "string" ? value.result : "",
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

  return subEvents.slice(-60);
}

// A finished subagent has no running internal tools — close any stragglers.
function settleSubEvents(subEvents) {
  if (!Array.isArray(subEvents)) return subEvents;
  if (!subEvents.some((item) => item.type === "tool" && item.status === "running")) {
    return subEvents;
  }
  return subEvents.map((item) =>
    item.type === "tool" && item.status === "running"
      ? { ...item, status: "completed" }
      : item,
  );
}

function replaceById(items, item) {
  const index = items.findIndex((x) => x.id === item.id);
  if (index === -1) return [...items, item];
  return items.map((x, i) => (i === index ? item : x));
}

function ensureConversationEntry(entries, type, refId) {
  if (entries.some((entry) => entry.type === type && entry.refId === refId)) {
    return entries;
  }
  return [...entries, { id: id(`entry-${type}`), type, refId }];
}

function normalizeClarificationQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((question, index) => {
      const text =
        typeof question?.text === "string" ? question.text.trim() : "";
      if (!text) return null;
      const options = Array.isArray(question.options)
        ? question.options
            .map((option) =>
              typeof option === "string" ? option.trim() : "",
            )
            .filter(Boolean)
        : [];
      return {
        id:
          typeof question.id === "string" && question.id.trim()
            ? question.id.trim()
            : `question_${index + 1}`,
        text,
        options,
        required: question.required !== false,
        allowCustom: question.allowCustom !== false,
      };
    })
    .filter(Boolean);
}

function buildClarificationTranscript(answers) {
  return answers
    .map((answer) => {
      const value = answer.skipped ? "Skipped" : answer.answer || "";
      return `Q: ${answer.question}\nA: ${value}`;
    })
    .join("\n\n");
}

const EMPTY_MESSAGES = [];
const EMPTY_STATE = {};

export function useAguiChat({
  url,
  agentId,
  threadId,
  headers,
  initialMessages = EMPTY_MESSAGES,
  initialState = EMPTY_STATE,
  onToolResult,
  onCreateThread,
  onRunFinished,
  onTitleGenerated,
} = {}) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const isParsedHistory = initialMessages && !Array.isArray(initialMessages) && typeof initialMessages === "object";
  const [messages, setMessages] = useState(isParsedHistory ? (initialMessages.messages || []) : initialMessages);
  const [conversation, setConversation] = useState(
    isParsedHistory
      ? (initialMessages.conversation || [])
      : initialMessages.map((message) => ({
          id: id("entry-message"),
          type: "message",
          refId: message.id,
        })),
  );
  const [toolCalls, setToolCalls] = useState(isParsedHistory ? (initialMessages.toolCalls || []) : []);
  const [agentState, setAgentState] = useState(initialState);
  const [isRunning, setIsRunning] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [error, setError] = useState(null);
  // Pending human-in-the-loop approval request emitted by the backend when the
  // agent pauses before running a guarded tool: { actionRequests, reviewConfigs }.
  const [pendingApproval, setPendingApproval] = useState(null);
  const [pendingClarification, setPendingClarification] = useState(null);

  const messagesRef = useRef(messages);
  const abortRef = useRef(null);
  const toolNameRef = useRef(new Map());
  const suppressClarificationNoticeRef = useRef(false);
  const promotingRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (promotingRef.current) {
      promotingRef.current = false;
      return;
    }

    const isParsedHistory = initialMessages && !Array.isArray(initialMessages) && typeof initialMessages === "object";
    const resetMessages = isParsedHistory ? (initialMessages.messages || []) : initialMessages;
    setMessages(resetMessages);
    setConversation(
      isParsedHistory
        ? (initialMessages.conversation || [])
        : resetMessages.map((message) => ({
            id: id("entry-message"),
            type: "message",
            refId: message.id,
          })),
    );
    setToolCalls(isParsedHistory ? (initialMessages.toolCalls || []) : []);
    setAgentState(initialState);
    setError(null);
    setPendingApproval(null);
    setPendingClarification(null);
    // Reset the chat only when the backing AG-UI thread changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const headerEntries = useMemo(
    () =>
      Object.entries(headers || {}).filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      ),
    [headers],
  );

  const upsertMessage = useCallback((message) => {
    setMessages((prev) => replaceById(prev, message));
    setConversation((prev) =>
      ensureConversationEntry(prev, "message", message.id),
    );
  }, []);

  const upsertTool = useCallback((tool) => {
    setToolCalls((prev) => replaceById(prev, tool));
    setConversation((prev) => ensureConversationEntry(prev, "tool", tool.id));
  }, []);

  // The run is over — nothing can still be executing. Close any tool card left
  // in "running" (e.g. a call streamed before an interrupt paused the graph).
  const settleRunningTools = useCallback(() => {
    setToolCalls((prev) =>
      prev.some((tool) => tool.status === "running")
        ? prev.map((tool) =>
            tool.status === "running"
              ? { ...tool, status: "completed", subEvents: settleSubEvents(tool.subEvents) }
              : tool,
          )
        : prev,
    );
  }, []);

  const applyEvent = useCallback(
    (event) => {
      const type = event.type;

      if (type === EventType.RUN_STARTED || type === "RUN_STARTED") {
        setIsRunning(true);
        setError(null);
        return;
      }

      if (type === EventType.RUN_FINISHED || type === "RUN_FINISHED") {
        setIsRunning(false);
        setIsReasoning(false);
        settleRunningTools();
        if (onRunFinished) onRunFinished();
        return;
      }

      if (type === EventType.RUN_ERROR || type === "RUN_ERROR") {
        setIsRunning(false);
        setIsReasoning(false);
        settleRunningTools();
        setError(event.message || "The agent stopped unexpectedly.");
        if (onRunFinished) onRunFinished();
        return;
      }

      if (
        type === EventType.TEXT_MESSAGE_START ||
        type === "TEXT_MESSAGE_START"
      ) {
        upsertMessage({
          id: event.messageId,
          role: event.role || "assistant",
          content: "",
        });
        return;
      }

      if (
        type === EventType.TEXT_MESSAGE_CONTENT ||
        type === EventType.TEXT_MESSAGE_CHUNK ||
        type === "TEXT_MESSAGE_CONTENT" ||
        type === "TEXT_MESSAGE_CHUNK"
      ) {
        if (suppressClarificationNoticeRef.current) {
          suppressClarificationNoticeRef.current = false;
          return;
        }

        const messageId = event.messageId || id("assistant");
        setMessages((prev) => {
          const current = prev.find((message) => message.id === messageId) || {
            id: messageId,
            role: event.role || "assistant",
            content: "",
          };
          return replaceById(prev, {
            ...current,
            content: `${current.content || ""}${event.delta || ""}`,
          });
        });
        setConversation((prev) =>
          ensureConversationEntry(prev, "message", messageId),
        );
        return;
      }

      if (
        type === EventType.REASONING_MESSAGE_START ||
        type === "REASONING_MESSAGE_START"
      ) {
        setIsReasoning(true);
        upsertMessage({
          id: event.messageId,
          role: "reasoning",
          content: "",
        });
        return;
      }

      if (
        type === EventType.REASONING_MESSAGE_CONTENT ||
        type === "REASONING_MESSAGE_CONTENT"
      ) {
        const messageId = event.messageId || id("reasoning");
        setMessages((prev) => {
          const current = prev.find((message) => message.id === messageId) || {
            id: messageId,
            role: "reasoning",
            content: "",
          };
          return replaceById(prev, {
            ...current,
            content: `${current.content || ""}${event.delta || ""}`,
          });
        });
        setConversation((prev) =>
          ensureConversationEntry(prev, "message", messageId),
        );
        return;
      }

      if (type === EventType.REASONING_END || type === "REASONING_END") {
        setIsReasoning(false);
        return;
      }

      if (type === EventType.TOOL_CALL_START || type === "TOOL_CALL_START") {
        toolNameRef.current.set(event.toolCallId, event.toolCallName);
        upsertTool({
          id: event.toolCallId,
          name: event.toolCallName || "tool",
          argumentsText: "",
          resultText: "",
          status: "running",
        });
        return;
      }

      if (
        type === EventType.TOOL_CALL_ARGS ||
        type === EventType.TOOL_CALL_CHUNK ||
        type === "TOOL_CALL_ARGS" ||
        type === "TOOL_CALL_CHUNK"
      ) {
        const toolCallId = event.toolCallId || id("tool");
        const toolName =
          event.toolCallName || toolNameRef.current.get(toolCallId) || "tool";
        toolNameRef.current.set(toolCallId, toolName);
        setToolCalls((prev) => {
          const current = prev.find((tool) => tool.id === toolCallId) || {
            id: toolCallId,
            name: toolName,
            argumentsText: "",
            resultText: "",
            status: "running",
          };
          return replaceById(prev, {
            ...current,
            name: toolName,
            argumentsText: `${current.argumentsText || ""}${event.delta || ""}`,
            status: "running",
          });
        });
        setConversation((prev) =>
          ensureConversationEntry(prev, "tool", toolCallId),
        );
        return;
      }

      if (type === EventType.TOOL_CALL_END || type === "TOOL_CALL_END") {
        setToolCalls((prev) =>
          prev.map((tool) => {
            if (tool.id !== event.toolCallId) return tool;
            // Args are complete at END — mirror write_todos into agent state
            // so the plan UI updates live instead of waiting for the
            // end-of-turn STATE_SNAPSHOT.
            const todos = todosFromToolArgs(tool.name, tool.argumentsText);
            if (todos) setAgentState((state) => ({ ...state, todos }));
            return { ...tool, status: "completed" };
          }),
        );
        return;
      }

      if (type === EventType.TOOL_CALL_RESULT || type === "TOOL_CALL_RESULT") {
        const toolCallId = event.toolCallId;
        const resultText = event.content || event.result || "";
        setToolCalls((prev) => {
          const current = prev.find((tool) => tool.id === toolCallId) || {
            id: toolCallId,
            name: toolNameRef.current.get(toolCallId) || "tool",
            argumentsText: "",
            resultText: "",
            status: "running",
          };
          const completedTool = {
            ...current,
            resultText,
            status: "completed",
            subEvents: settleSubEvents(current.subEvents),
          };
          if (onToolResult) onToolResult(completedTool);
          // Args are complete once the result arrives — mirror write_todos and
          // file writes into agent state so the plan / Files panel update
          // mid-run instead of waiting for the end-of-turn STATE_SNAPSHOT.
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

      if (type === EventType.CUSTOM || type === "CUSTOM") {
        if (
          event.name === "hitl_request" &&
          Array.isArray(event.value?.actionRequests)
        ) {
          setPendingClarification(null);
          setPendingApproval({
            actionRequests: event.value.actionRequests,
            reviewConfigs: event.value.reviewConfigs || [],
          });
        } else if (event.name === "subagent_activity") {
          // Live activity from a subagent, attributed to its `task` tool card
          // as a structured timeline: streamed text plus the subagent's own
          // tool calls. Bounded so a chatty subagent can't grow state forever.
          const { toolCallId, kind } = event.value || {};
          if (toolCallId) {
            setToolCalls((prev) =>
              prev.map((tool) => {
                if (tool.id !== toolCallId) return tool;
                const subEvents = appendSubEvent(tool.subEvents, kind, event.value);
                return subEvents ? { ...tool, subEvents } : tool;
              }),
            );
          }
        } else if (event.name === "mcp_app") {
          // MCP App UI metadata for a specific tool call.
          // The backend emits this when a tool with _meta.ui.resourceUri is called.
          const { toolCallId, resourceUri, mcpId } = event.value || {};
          if (toolCallId && resourceUri && mcpId) {
            setToolCalls((prev) =>
              prev.map((tool) =>
                tool.id === toolCallId
                  ? { ...tool, mcpApp: { resourceUri, mcpId } }
                  : tool,
              ),
            );
          }
        } else if (event.name === "clarification_request") {
          const questions = normalizeClarificationQuestions(
            event.value?.questions,
          );
          if (questions.length > 0) {
            setPendingApproval(null);
            setPendingClarification({
              questions,
              currentIndex: Number.isInteger(event.value?.currentIndex)
                ? event.value.currentIndex
                : 0,
              answers: [],
            });
            suppressClarificationNoticeRef.current = true;
          }
        }
        return;
      }

      if (type === EventType.STATE_SNAPSHOT || type === "STATE_SNAPSHOT") {
        setAgentState(event.snapshot || {});
        return;
      }

      if (type === "title" || type === EventType.TITLE) {
        if (onTitleGenerated && event.title) {
          onTitleGenerated(event.title);
        }
        return;
      }

      if (
        type === EventType.MESSAGES_SNAPSHOT ||
        type === "MESSAGES_SNAPSHOT"
      ) {
        const nextMessages = Array.isArray(event.messages)
          ? event.messages.map((message) => ({
              id: message.id || id("message"),
              role: message.role || "assistant",
              content: contentToText(message.content),
            }))
          : [];
        setMessages(nextMessages);
        setConversation(
          nextMessages.map((message) => ({
            id: id("entry-message"),
            type: "message",
            refId: message.id,
          })),
        );
      }
    },
    [onToolResult, onRunFinished, onTitleGenerated, settleRunningTools, upsertMessage, upsertTool],
  );

  // SSE events arrive far faster than the screen refreshes (one per LLM token).
  // Applying each one immediately means a React render per token, which
  // saturates the main thread and makes streaming feel laggy. Queue them and
  // flush once per animation frame instead — visually identical, ~60 renders/s
  // cap regardless of token rate.
  const eventQueueRef = useRef([]);
  const flushScheduledRef = useRef(false);
  const applyEventRef = useRef(applyEvent);

  useEffect(() => {
    applyEventRef.current = applyEvent;
  }, [applyEvent]);

  const flushEvents = useCallback(() => {
    flushScheduledRef.current = false;
    const queue = eventQueueRef.current;
    if (queue.length === 0) return;
    eventQueueRef.current = [];
    // One pass through the queue inside a single callback — React batches all
    // the resulting state updates into one render.
    for (const event of queue) applyEventRef.current(event);
  }, []);

  const enqueueEvent = useCallback(
    (event) => {
      eventQueueRef.current.push(event);
      if (flushScheduledRef.current) return;
      flushScheduledRef.current = true;
      if (typeof requestAnimationFrame === "function" && !document.hidden) {
        requestAnimationFrame(flushEvents);
      } else {
        // Background tabs never fire rAF — keep draining so state stays live.
        setTimeout(flushEvents, 32);
      }
    },
    [flushEvents],
  );

  const runStream = useCallback(
    async ({ messages: bodyMessages, resume, threadIdOverride }) => {
      setError(null);
      setIsRunning(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        if (!isLoaded) {
          throw new Error("Authentication is still loading. Please try again.");
        }
        if (!isSignedIn) {
          throw new Error("Please sign in to run this agent.");
        }

        const clerkToken = await getToken();
        if (!clerkToken) {
          throw new Error("Unable to get a Clerk session token. Please sign in again.");
        }

        const activeThreadId = threadIdOverride || threadId;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...Object.fromEntries(headerEntries),
            Authorization: `Bearer ${clerkToken}`,
            "X-Thread-Id": activeThreadId,
          },
          body: JSON.stringify({
            threadId: activeThreadId,
            runId: id("run"),
            agentId,
            messages: bodyMessages.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
            })),
            ...(resume ? { resume } : {}),
            state: agentState,
            tools: [],
            context: [],
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
            const event = parseJsonMaybe(data);
            if (event) enqueueEvent(event);
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Streaming failed.");
        }
      } finally {
        // Drain anything still queued (any rAF already scheduled becomes a no-op).
        flushEvents();
        setIsRunning(false);
        setIsReasoning(false);
        abortRef.current = null;
      }
    },
    [
      agentId,
      agentState,
      enqueueEvent,
      flushEvents,
      getToken,
      headerEntries,
      isLoaded,
      isSignedIn,
      threadId,
      url,
    ],
  );

  const appendUserMessage = useCallback((content) => {
    const userMessage = {
      id: id("user"),
      role: "user",
      content,
    };
    const nextMessages = [...messagesRef.current, userMessage];
    setMessages(nextMessages);
    setConversation((prev) =>
      ensureConversationEntry(prev, "message", userMessage.id),
    );
    return nextMessages;
  }, []);

  // Resolve a pending approval request with explicit HITL decisions
  // ({ type: "approve" } | { type: "reject", message }). `displayText` is shown
  // in the transcript as the user's reply.
  const respondToApproval = useCallback(
    async (decisions, { displayText } = {}) => {
      if (!pendingApproval || !url || isRunning) return;
      if (!Array.isArray(decisions) || decisions.length === 0) return;

      setPendingApproval(null);
      // Button decisions resume silently — only genuine typed feedback is
      // worth keeping in the transcript as a user message.
      const nextMessages = displayText
        ? appendUserMessage(displayText)
        : messagesRef.current;
      await runStream({ messages: nextMessages, resume: { decisions } });
    },
    [appendUserMessage, isRunning, pendingApproval, runStream, url],
  );

  const respondToClarification = useCallback(
    async ({ answer = "", optionIndex = null, freeform = false, skipped = false } = {}) => {
      if (!pendingClarification || !url || isRunning) return;

      const currentIndex = pendingClarification.currentIndex || 0;
      const question = pendingClarification.questions[currentIndex];
      if (!question) return;

      const normalizedAnswer = skipped ? "" : String(answer || "").trim();
      if (!skipped && !normalizedAnswer) return;

      const nextAnswer = {
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
    [
      appendUserMessage,
      isRunning,
      pendingClarification,
      runStream,
      url,
    ],
  );

  const send = useCallback(
    async (text) => {
      const content = text.trim();
      if (!content || !url || isRunning) return;

      // A typed reply while an approval is pending is treated as
      // reject-with-feedback so the agent re-plans with the user's message.
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

      let threadIdOverride;
      if (threadId === "new" && onCreateThread) {
        promotingRef.current = true;
        threadIdOverride = await onCreateThread();
      }

      await runStream({ messages: nextMessages, threadIdOverride });
    },
    [
      appendUserMessage,
      isRunning,
      pendingApproval,
      pendingClarification,
      respondToApproval,
      respondToClarification,
      runStream,
      url,
      threadId,
      onCreateThread,
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
    setAgentState(initialState);
    setError(null);
    setPendingApproval(null);
    setPendingClarification(null);
  }, [initialState, stop]);

  return {
    messages,
    conversation,
    toolCalls,
    agentState,
    isRunning,
    isReasoning,
    error,
    pendingApproval,
    pendingClarification,
    respondToApproval,
    respondToClarification,
    send,
    stop,
    clear,
  };
}
