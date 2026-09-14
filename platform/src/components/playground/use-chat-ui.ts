import * as React from "react";
import {
  type UseAguiChatReturn,
  type ChatMessage as HookChatMessage,
  type ToolCall as HookToolCall,
  type ConversationEntry as HookConversationEntry,
} from "@/lib/agui/use-agui-chat";
import {
  toChatView,
  hitlInterruptFrom,
  clarificationInterruptFrom,
} from "@/lib/agui/chat-adapter";
import type { ChatInterruptData } from "@/components/chat";

/**
 * The parts of `useAguiChat`'s return value this hook needs — both
 * `AgentChat` and `ArchitectChat` pass their own `useAguiChat(...)` result in
 * directly (that call itself stays in each component, since the url/agentId
 * construction genuinely differs), so only the fields actually read here are
 * required.
 */
type ChatForUI = Pick<
  UseAguiChatReturn,
  | "messages"
  | "toolCalls"
  | "conversation"
  | "isRunning"
  | "pendingApproval"
  | "pendingClarification"
  | "respondToApproval"
  | "respondToClarification"
>;

/**
 * Shared derived UI state for any AG-UI chat surface in the Playground
 * (a real Agent's test chat, or the Architect) — the `toChatView` transcript
 * projection plus HITL/clarification interrupt handling. This was
 * byte-for-byte duplicated between `agent-chat.tsx` and `architect-chat.tsx`
 * (each with its own slightly different HITL-buffer implementation) before
 * being extracted here; both now get the same (ref-based, no extra
 * `useEffect`) implementation.
 */
export function useAguiChatUI(chat: ChatForUI) {
  const { respondToApproval, respondToClarification } = chat;

  const view = React.useMemo(
    () =>
      toChatView({
        messages: chat.messages,
        toolCalls: chat.toolCalls,
        conversation: chat.conversation,
        isRunning: chat.isRunning,
      }),
    [chat.messages, chat.toolCalls, chat.conversation, chat.isRunning]
  );

  const interrupt = React.useMemo<ChatInterruptData | null>(() => {
    if (chat.pendingApproval) return hitlInterruptFrom(chat.pendingApproval);
    if (chat.pendingClarification?.questions?.length) {
      return clarificationInterruptFrom(chat.pendingClarification);
    }
    return null;
  }, [chat.pendingApproval, chat.pendingClarification]);

  // HITL: the whole request is answered at once — buffer one decision per
  // action (keyed by its positional id), then fire them all together. Kept
  // in a ref (not useState+useEffect) so a new pendingApproval object resets
  // the buffer lazily, on the next decision, instead of needing a dedicated
  // effect just to clear state.
  const hitlRef = React.useRef<{
    approval: object;
    decisions: Record<string, "approve" | "reject">;
    fired: boolean;
  } | null>(null);

  const handleDecideHitl = React.useCallback(
    (actionId: string, decision: "approve" | "reject") => {
      const approval = chat.pendingApproval;
      if (!approval) return;
      if (!hitlRef.current || hitlRef.current.approval !== approval) {
        hitlRef.current = { approval, decisions: {}, fired: false };
      }
      const held = hitlRef.current;
      if (held.fired) return;
      const next = { ...held.decisions, [actionId]: decision };
      held.decisions = next;
      const { actionRequests } = approval;
      const allDecided =
        actionRequests.length > 0 && actionRequests.every((_, i) => next[String(i)]);
      if (allDecided) {
        held.fired = true;
        void respondToApproval(
          actionRequests.map((_, i) =>
            next[String(i)] === "reject"
              ? { type: "reject", message: "Rejected by the developer." }
              : { type: "approve" }
          )
        );
      }
    },
    [chat.pendingApproval, respondToApproval]
  );

  // Clarification: the hook answers ONE question at a time, so the panel
  // shows a single-question wizard slice; each submit answers only the
  // current step. The busy flag lives in a ref so a second submit can't
  // double-answer.
  const clarRef = React.useRef<{ clar: object; busy: boolean } | null>(null);

  const handleSubmitClarification = React.useCallback(
    (answers: Record<string, string>) => {
      const clar = chat.pendingClarification;
      if (!clar) return;
      if (!clarRef.current || clarRef.current.clar !== clar) {
        clarRef.current = { clar, busy: false };
      }
      const held = clarRef.current;
      if (held.busy) return;
      const q = clar.questions[clar.currentIndex || 0];
      if (!q) return;
      const value = answers[q.id ?? `q-${clar.currentIndex || 0}`];
      held.busy = true;
      if (value && value.trim()) {
        void respondToClarification({ answer: value.trim(), freeform: true });
      } else {
        void respondToClarification({ skipped: true });
      }
    },
    [chat.pendingClarification, respondToClarification]
  );

  const interruptKey = chat.pendingApproval
    ? "hitl"
    : `clar-${chat.pendingClarification?.currentIndex ?? 0}`;

  return { view, interrupt, interruptKey, handleDecideHitl, handleSubmitClarification };
}

/** The `getToken` every Playground AG-UI chat passes to `useAguiChat` — reads
 * the Clerk session token off `window.Clerk`, same implementation
 * `agent-chat.tsx` and `architect-chat.tsx` each had their own copy of. */
export function useClerkGetToken(): () => Promise<string | null> {
  return React.useCallback(
    () =>
      typeof window !== "undefined"
        ? (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string> } } })
            .Clerk?.session?.getToken?.() ?? Promise.resolve(null)
        : Promise.resolve(null),
    []
  );
}

export type { HookChatMessage, HookToolCall, HookConversationEntry };
