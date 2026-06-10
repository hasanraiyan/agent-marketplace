"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { id, replaceById, ensureConversationEntry } from "./utils";

export function useChatHistory({ initialMessages, initialState, threadId }) {
  const isParsedHistory =
    initialMessages &&
    !Array.isArray(initialMessages) &&
    typeof initialMessages === "object";

  const [messages, setMessages] = useState(
    isParsedHistory ? initialMessages.messages || [] : initialMessages || [],
  );
  const [conversation, setConversation] = useState(
    isParsedHistory
      ? initialMessages.conversation || []
      : (initialMessages || []).map((message) => ({
          id: id("entry-message"),
          type: "message",
          refId: message.id,
        })),
  );
  const [toolCalls, setToolCalls] = useState(
    isParsedHistory ? initialMessages.toolCalls || [] : [],
  );
  const [agentState, setAgentState] = useState(initialState || {});

  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const isParsedHistory =
      initialMessages &&
      !Array.isArray(initialMessages) &&
      typeof initialMessages === "object";
    const resetMessages = isParsedHistory
      ? initialMessages.messages || []
      : initialMessages || [];

    setMessages(resetMessages);
    setConversation(
      isParsedHistory
        ? initialMessages.conversation || []
        : resetMessages.map((message) => ({
            id: id("entry-message"),
            type: "message",
            refId: message.id,
          })),
    );
    setToolCalls(isParsedHistory ? initialMessages.toolCalls || [] : []);
    setAgentState(initialState || {});
    // Reset the chat only when the backing AG-UI thread changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

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

  const clearHistory = useCallback(() => {
    setMessages([]);
    setConversation([]);
    setToolCalls([]);
    setAgentState(initialState || {});
  }, [initialState]);

  return {
    messages,
    setMessages,
    messagesRef,
    conversation,
    setConversation,
    toolCalls,
    setToolCalls,
    agentState,
    setAgentState,
    upsertMessage,
    upsertTool,
    clearHistory,
  };
}
