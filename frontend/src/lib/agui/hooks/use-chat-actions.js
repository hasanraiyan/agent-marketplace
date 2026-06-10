"use client";

import { useCallback, useState } from "react";
import {
  id,
  ensureConversationEntry,
  buildClarificationTranscript,
} from "./utils";

export function useChatActions({
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
}) {
  const appendUserMessage = useCallback(
    (content) => {
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
    },
    [messagesRef, setMessages, setConversation],
  );

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
    [appendUserMessage, isRunning, messagesRef, pendingApproval, runStream, url, setPendingApproval],
  );

  const respondToClarification = useCallback(
    async ({
      answer = "",
      optionIndex = null,
      freeform = false,
      skipped = false,
    } = {}) => {
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
    [appendUserMessage, isRunning, pendingClarification, runStream, url, setPendingClarification],
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
      await runStream({ messages: nextMessages });
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
    ],
  );

  const clear = useCallback(() => {
    stopStream();
    clearHistory();
    setPendingApproval(null);
    setPendingClarification(null);
    setError(null);
  }, [stopStream, clearHistory, setPendingApproval, setPendingClarification, setError]);

  return {
    respondToApproval,
    respondToClarification,
    send,
    clear,
  };
}
