import type { HttpClient } from '../http.js';
import type {
  AgentMessageDelivery,
  GenerateReplyInput,
  GeneratedReply,
  MessageDelivery,
  SendAgentMessageInput,
  SendMessageInput,
} from '../types/message.js';

/**
 * SMS / WhatsApp (`/api/v1/developer/messages`) — outbound messaging from
 * this Project's own Twilio sender.
 *
 * Both methods take the recipient's E.164 number directly; the channel is
 * inferred from a `whatsapp:` prefix unless `channel` is given. No external
 * user needs to be asserted: the phone number itself is the conversation
 * identity, shared across SMS, WhatsApp, and voice for the same
 * (Project, Agent, number) — so a reply to the same user continues the same
 * conversation your inbound webhook and voice calls already use.
 *
 * Two ways to use this, depending on whose Twilio number it is:
 *
 * - **Persona-hosted number:** inbound messages are delivered to Persona's
 *   webhook and answered end-to-end — nothing to wire up beyond pointing the
 *   number at Persona. Use `send` / `sendFromAgent` for outbound.
 * - **Your own number:** your webhook receives the message, calls
 *   {@link MessagesResource.generateReply} to get the Agent's text, and
 *   delivers it itself (inline TwiML). Persona never sends on this path, so
 *   it never needs your Twilio credentials.
 */
export class MessagesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Sends a plain message — no Agent involved.
   * @param input - `to` is required; `body` is required unless you pass an
   *   approved WhatsApp `contentSid` template.
   * @returns The channel used, the sender, one SID per delivered part, and
   *   how many parts a long body was split into.
   * @throws {@link PersonaApiError} with code `TWILIO_PROJECT_SECRETS_REQUIRED`
   *   / `TWILIO_PHONE_NUMBER_REQUIRED` / `TWILIO_WHATSAPP_NUMBER_REQUIRED` /
   *   `TWILIO_SMS_NUMBER_REQUIRED` when the Project's Twilio secrets are
   *   incomplete, or `MESSAGE_LOOP_DETECTED` when `to` is the Project's own
   *   sender number.
   * @example
   * ```ts
   * await client.messages.send({ to: '+919876543210', body: 'Your order shipped!' });
   * await client.messages.send({ to: '+919876543210', channel: 'whatsapp', body: 'Hi!' });
   *
   * // Business-initiated WhatsApp outside the 24-hour window needs a template:
   * await client.messages.send({
   *   to: '+919876543210',
   *   channel: 'whatsapp',
   *   contentSid: 'HX...',
   *   contentVariables: { '1': 'Raiyan', '2': 'ORD-42' },
   * });
   * ```
   */
  async send(input: SendMessageInput): Promise<MessageDelivery> {
    return this.http.request<MessageDelivery>('POST', '/api/v1/developer/messages', {
      body: input,
    });
  }

  /**
   * Runs the Agent on the conversation shared by all channels for this phone
   * number, then delivers its reply over SMS/WhatsApp.
   * @param input - `agentId`, `to`, and the `prompt` the Agent responds to.
   * @returns The delivery result plus the `agentId` that replied.
   * @throws {@link PersonaApiError} with code `AGENT_RUN_FAILED` or
   *   `AGENT_EMPTY_REPLY` (502) when the Agent errored or produced no text;
   *   404 when the Agent isn't owned by this Project; 422 when the Agent has
   *   guarded (`interruptOn`) tools, which have no confirmation flow on
   *   text channels — same restriction as voice.
   * @example
   * ```ts
   * const delivery = await client.messages.sendFromAgent({
   *   agentId: agent._id,
   *   to: '+919876543210',
   *   prompt: 'Remind the customer their appointment is tomorrow at 10.',
   * });
   * console.log(delivery.messageSids, delivery.parts);
   * ```
   */
  async sendFromAgent(input: SendAgentMessageInput): Promise<AgentMessageDelivery> {
    return this.http.request<AgentMessageDelivery>('POST', '/api/v1/developer/messages/agent', {
      body: input,
    });
  }

  /**
   * Runs the Agent for one of your users and returns its reply **without
   * delivering it** — for a WhatsApp/SMS message that arrived on YOUR OWN
   * Twilio number.
   *
   * Call this from your Twilio messaging webhook after you have resolved the
   * sender to one of your users, then answer Twilio with the reply, e.g.
   * `<Response><Message>${reply}</Message></Response>`. Nothing is charged to
   * Persona's Twilio account and your credentials stay on your side.
   *
   * The conversation is keyed by `externalUserId`, so the same user's web
   * chat, WhatsApp messages and phone calls share one thread.
   *
   * @param input - `agentId`, the inbound `text`, and (optionally)
   *   `externalUserId` when the client isn't already bound to that user.
   * @returns The reply text plus the `threadId` it was written to.
   * @throws {@link PersonaApiError} with code `EXTERNAL_USER_REQUIRED` when no
   *   user is asserted, `AGENT_RUN_FAILED` / `AGENT_EMPTY_REPLY` (502) when the
   *   run errored or produced no text, 404 when the Agent isn't yours, and 422
   *   when the Agent has guarded (`interruptOn`) tools — same restriction as
   *   voice.
   * @example
   * ```ts
   * // In your Twilio messaging webhook, after verifying the signature:
   * const user = await db.user.findByPhone(req.body.From);
   * const { reply } = await client.messages.generateReply({
   *   agentId,
   *   externalUserId: user.id,
   *   text: req.body.Body,
   *   displayName: req.body.ProfileName,
   * });
   * res.type('text/xml').send(`<Response><Message>${escapeXml(reply)}</Message></Response>`);
   * ```
   */
  async generateReply(input: GenerateReplyInput): Promise<GeneratedReply> {
    const { externalUserId, ...body } = input;
    return this.http.request<GeneratedReply>('POST', '/api/v1/developer/messages/agent/reply', {
      body,
      ...(externalUserId ? { externalUserId } : {}),
    });
  }
}
