"use client";

import { useChatHistory } from "./hooks/use-chat-history";
import { useMessageStream } from "./hooks/use-message-stream";
import { useChatActions } from "./hooks/use-chat-actions";

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
  const {
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
  } = useChatHistory({ initialMessages, initialState, threadId });

  const {
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
  } = useMessageStream({
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
  });

  const {
    respondToApproval,
    respondToClarification,
    send,
    clear,
  } = useChatActions({
    url,
    isRunning,
    messagesRef,
    setMessages,
    setConversation,
    runStream,
    stopStream,
    clearHistory,
    pendingApproval,
    setPendingApproval,
    pendingClarification,
    setPendingClarification,
    setError,
  });

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
    stop: stopStream,
    clear,
  };
}
