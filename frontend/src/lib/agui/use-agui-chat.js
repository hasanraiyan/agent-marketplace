"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventType } from "@ag-ui/client";

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
  onRunFinished,
} = {}) {
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

  const messagesRef = useRef(messages);
  const abortRef = useRef(null);
  const toolNameRef = useRef(new Map());

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
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
        if (onRunFinished) onRunFinished();
        return;
      }

      if (type === EventType.RUN_ERROR || type === "RUN_ERROR") {
        setIsRunning(false);
        setIsReasoning(false);
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
          prev.map((tool) =>
            tool.id === event.toolCallId
              ? { ...tool, status: "completed" }
              : tool,
          ),
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
          const completedTool = { ...current, resultText, status: "completed" };
          if (onToolResult) onToolResult(completedTool);
          return replaceById(prev, completedTool);
        });
        return;
      }

      if (type === EventType.CUSTOM || type === "CUSTOM") {
        if (
          event.name === "hitl_request" &&
          Array.isArray(event.value?.actionRequests)
        ) {
          setPendingApproval({
            actionRequests: event.value.actionRequests,
            reviewConfigs: event.value.reviewConfigs || [],
          });
        }
        return;
      }

      if (type === EventType.STATE_SNAPSHOT || type === "STATE_SNAPSHOT") {
        setAgentState(event.snapshot || {});
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
    [onToolResult, onRunFinished, upsertMessage, upsertTool],
  );

  const runStream = useCallback(
    async ({ messages: bodyMessages, resume }) => {
      setError(null);
      setIsRunning(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...Object.fromEntries(headerEntries),
          },
          body: JSON.stringify({
            threadId,
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
            if (event) applyEvent(event);
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Streaming failed.");
        }
      } finally {
        setIsRunning(false);
        setIsReasoning(false);
        abortRef.current = null;
      }
    },
    [agentId, agentState, applyEvent, headerEntries, threadId, url],
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
      const nextMessages = appendUserMessage(
        displayText ||
          (decisions.every((d) => d.type === "approve")
            ? "Approved"
            : "Rejected"),
      );
      await runStream({ messages: nextMessages, resume: { decisions } });
    },
    [appendUserMessage, isRunning, pendingApproval, runStream, url],
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

      const nextMessages = appendUserMessage(content);
      await runStream({ messages: nextMessages });
    },
    [
      appendUserMessage,
      isRunning,
      pendingApproval,
      respondToApproval,
      runStream,
      url,
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
    respondToApproval,
    send,
    stop,
    clear,
  };
}
