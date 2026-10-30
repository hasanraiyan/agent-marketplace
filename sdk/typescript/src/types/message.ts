/** Delivery channel for an outbound message. */
export type MessageChannel = 'sms' | 'whatsapp';

/**
 * Input for {@link MessagesResource.send} — a plain, non-agent message from
 * the Project's own Twilio sender.
 */
export interface SendMessageInput {
  /** E.164 recipient, e.g. `+919876543210`. A `whatsapp:` prefix also selects the channel. */
  to: string;
  /** Explicit channel. When omitted, inferred from a `whatsapp:` prefix on `to` (else `sms`). */
  channel?: MessageChannel;
  /**
   * The message body. Markdown is stripped and long bodies are split into
   * multiple messages (SMS ~1500 chars, WhatsApp ~4000). Required unless
   * `contentSid` is given.
   */
  body?: string;
  /** Public URL(s) for media attached to the first part of the message. */
  mediaUrl?: string | string[];
  /**
   * Approved WhatsApp template SID. Takes precedence over `body` — use this
   * for business-initiated conversations outside WhatsApp's 24-hour
   * customer-service window.
   */
  contentSid?: string;
  /** Template variable values, keyed by the template's positional placeholders (`"1"`, `"2"`, …). */
  contentVariables?: Record<string, string> | string;
}

/** Result of delivering a message (or the parts it was split into). */
export interface MessageDelivery {
  /** The channel actually used, after inference from `to`. */
  channel: MessageChannel;
  /** Normalized E.164 recipient. */
  to: string;
  /** Sender number the message went out from, or `null` when sent via a Messaging Service. */
  from: string | null;
  /** One SID per delivered part — long bodies arrive as several messages. */
  messageSids: string[];
  /** Twilio status of the first part (`queued`, `sent`, …), or `null`. */
  status: string | null;
  /** Number of parts the body was split into. */
  parts: number;
}

/**
 * Input for {@link MessagesResource.sendFromAgent} — runs the Agent and
 * delivers its reply over SMS/WhatsApp.
 */
export interface SendAgentMessageInput {
  /** The Agent that composes the reply. Must belong to this Project. */
  agentId: string;
  /** E.164 recipient, e.g. `+919876543210`. Also the shared conversation identity (all channels). */
  to: string;
  /** Explicit channel. When omitted, inferred from a `whatsapp:` prefix on `to` (else `sms`). */
  channel?: MessageChannel;
  /** The message the Agent responds to. */
  prompt: string;
  /** Optional display name recorded for a new external user (e.g. a WhatsApp profile name). */
  displayName?: string;
}

/** Result of an Agent-composed delivery — {@link MessageDelivery} plus the Agent that replied. */
export interface AgentMessageDelivery extends MessageDelivery {
  agentId: string;
}

/**
 * Input for {@link MessagesResource.generateReply} — run the Agent and get
 * its text back, without Persona sending anything.
 */
export interface GenerateReplyInput {
  /** The Agent that composes the reply. Must belong to this Project. */
  agentId: string;
  /** The inbound message the Agent responds to. */
  text: string;
  /**
   * Your own user id for the sender. This — not the phone number — is the
   * conversation identity, so the reply continues the same thread as that
   * user's web chat and phone calls. Defaults to the client's
   * `externalUserId` when omitted.
   */
  externalUserId?: string;
  /** Optional display name recorded for a new external user (e.g. a WhatsApp profile name). */
  displayName?: string;
  /** Continue an existing Thread instead of the per-user default. */
  threadId?: string;
}

/** Result of {@link MessagesResource.generateReply}. */
export interface GeneratedReply {
  /** The Agent that produced the reply. */
  agentId: string;
  /** The reply text — nothing was sent; deliver it yourself. */
  reply: string;
  /** The conversation thread this turn was written to. */
  threadId: string;
}
