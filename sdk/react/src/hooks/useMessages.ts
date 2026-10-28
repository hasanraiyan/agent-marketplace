"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type {
  PersonaAgentMessageDelivery,
  PersonaMessageDelivery,
  SendPersonaAgentMessageInput,
  SendPersonaMessageInput,
  UseMessagesResult,
} from "../types.js";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const message = body?.error?.message ?? body?.message;
    if (typeof message === "string" && message) return message;
  } catch {
    // Body wasn't JSON — fall through to the status text.
  }
  return `${fallback}: ${res.statusText}`;
}

/**
 * Outbound SMS/WhatsApp — `POST /messages` and `POST /messages/agent` on your
 * own backend (`createRuntime` or a framework adapter on top of it). Both
 * sends go through `fetchWithAuth`, exactly like every other hook here; the
 * Project credential never reaches the browser.
 *
 * Requires the host runtime to opt in with `capabilities: { messages: true }`
 * — unlike `chat`/`voice`, messaging isn't end-user-scoped server-side (`to`
 * is any E.164 number and each send spends the Project's Twilio balance), so
 * it's off by default and both routes 404 until enabled. Enabling it also
 * means every caller your `resolveUser` accepts on that mount can text
 * arbitrary numbers through it — gate it accordingly.
 *
 * Conversations are keyed by phone number, so an SMS, a WhatsApp message, and
 * a voice call with the same (Project, Agent, number) share one thread:
 * `sendFromAgent()` continues whatever conversation is already in progress
 * there rather than starting fresh.
 */
export function useMessages(): UseMessagesResult {
  const { fetchWithAuth, logger } = usePersonaContext();
  const messagesLogger = useMemo(() => logger.child("messages"), [logger]);

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastDelivery, setLastDelivery] = useState<
    PersonaMessageDelivery | PersonaAgentMessageDelivery | null
  >(null);
  // Counter, not a boolean — overlapping sends shouldn't clear `isSending`
  // while one is still in flight.
  const inFlightRef = useRef(0);

  const post = useCallback(
    async <T extends PersonaMessageDelivery | PersonaAgentMessageDelivery>(
      path: string,
      input: unknown,
    ): Promise<T> => {
      inFlightRef.current += 1;
      setIsSending(true);
      setError(null);
      try {
        const res = await fetchWithAuth(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          throw new Error(await readErrorMessage(res, "Failed to send message"));
        }
        const payload = await res.json();
        const delivery = (payload?.data ?? payload) as T;
        setLastDelivery(delivery);
        messagesLogger.info("message sent", { path });
        return delivery;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        messagesLogger.warn("message send failed", {
          path,
          error: errorObj.message,
        });
        setError(errorObj);
        throw errorObj;
      } finally {
        inFlightRef.current -= 1;
        if (inFlightRef.current === 0) setIsSending(false);
      }
    },
    [fetchWithAuth, messagesLogger],
  );

  const send = useCallback(
    (input: SendPersonaMessageInput) => post<PersonaMessageDelivery>("/messages", input),
    [post],
  );

  const sendFromAgent = useCallback(
    (input: SendPersonaAgentMessageInput) =>
      post<PersonaAgentMessageDelivery>("/messages/agent", input),
    [post],
  );

  return { isSending, error, lastDelivery, send, sendFromAgent };
}
