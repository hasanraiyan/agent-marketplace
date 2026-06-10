"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { EventType } from "@ag-ui/client";
import { useAuth } from "@clerk/nextjs";
import {
  id,
  parseJsonMaybe,
  contentToText,
  todosFromToolArgs,
  replaceById,
  ensureConversationEntry,
  normalizeClarificationQuestions,
} from "./utils";

export function useMessageStream({
  url,
  agentId,
  threadId,
  headers,
  onToolResult,
  onRunFinished,
  upsertMessage,
  upsertTool,
  setMessages,
  setConversation,
  setToolCalls,
  agentState,
  setAgentState,
}) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [error, setError] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [pendingClarification, setPendingClarification] = useState(null);

  const abortRef = useRef(null);
  const toolNameRef = useRef(new Map());
  const suppressClarificationNoticeRef = useRef(false);

  useEffect(() => {
    setError(null);
    setPendingApproval(null);
    setPendingClarification(null);
  }, [threadId]);

  const headerEntries = useMemo(
    () =>
      Object.entries(headers || {}).filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      ),
    [headers],
  );

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
          setPendingClarification(null);
          setPendingApproval({
            actionRequests: event.value.actionRequests,
            reviewConfigs: event.value.reviewConfigs || [],
          });
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
    [
      onToolResult,
      onRunFinished,
      upsertMessage,
      upsertTool,
      setMessages,
      setConversation,
      setToolCalls,
      setAgentState,
    ],
  );

  const runStream = useCallback(
    async ({ messages: bodyMessages, resume }) => {
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
          throw new Error(
            "Unable to get a Clerk session token. Please sign in again.",
          );
        }

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...Object.fromEntries(headerEntries),
            Authorization: `Bearer ${clerkToken}`,
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
    [
      agentId,
      agentState,
      applyEvent,
      getToken,
      headerEntries,
      isLoaded,
      isSignedIn,
      threadId,
      url,
    ],
  );

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
    setIsReasoning(false);
  }, []);

  return {
    isRunning,
    isReasoning,
    error,
    setError,
    pendingApproval,
    setPendingApproval,
    pendingClarification,
    setPendingClarification,
    runStream,
    stopStream,
  };
}
