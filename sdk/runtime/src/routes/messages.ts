import type { RouteHandler } from '../routing.js';
import { RuntimeHttpError } from '../errors.js';
import { json, requireBodyObject, requireStringField } from '../routeHelpers.js';

/**
 * Outbound SMS / WhatsApp routes — thin proxies over `@personaai/sdk`'s
 * `client.messages.send()` / `sendFromAgent()`.
 *
 * Unlike voice, these are NOT end-user-scoped: `to` is any E.164 number and
 * the send spends this Project's Twilio balance, so the routes are gated
 * behind `capabilities.messages` (off by default) rather than being always
 * on. The resolved user still has to authenticate, but the host should turn
 * this on only for callers it actually wants to be able to text people.
 */

const MESSAGE_CHANNELS = new Set(['sms', 'whatsapp']);

function optionalChannel(body: Record<string, unknown>): 'sms' | 'whatsapp' | undefined {
  const value = body.channel;
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !MESSAGE_CHANNELS.has(value)) {
    throw new RuntimeHttpError(400, 'INVALID_REQUEST', '"channel" must be "sms" or "whatsapp".');
  }
  return value as 'sms' | 'whatsapp';
}

function optionalStringField(
  body: Record<string, unknown>,
  field: string
): string | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    throw new RuntimeHttpError(400, 'INVALID_REQUEST', `"${field}" must be a non-empty string.`);
  }
  return value;
}

function optionalMediaUrl(body: Record<string, unknown>): string | string[] | undefined {
  const value = body.mediaUrl;
  if (value === undefined) return undefined;
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.length > 0)) {
    return value as string[];
  }
  throw new RuntimeHttpError(
    400,
    'INVALID_REQUEST',
    '"mediaUrl" must be a string or an array of strings.'
  );
}

function optionalContentVariables(
  body: Record<string, unknown>
): Record<string, string> | string | undefined {
  const value = body.contentVariables;
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
  throw new RuntimeHttpError(
    400,
    'INVALID_REQUEST',
    '"contentVariables" must be an object or a JSON string.'
  );
}

/** `POST /messages` — plain message, no Agent involved. */
export const sendMessage: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const to = requireStringField(body, 'to');
  const channel = optionalChannel(body);
  const text = optionalStringField(body, 'body');
  const mediaUrl = optionalMediaUrl(body);
  const contentSid = optionalStringField(body, 'contentSid');
  const contentVariables = optionalContentVariables(body);

  if (text === undefined && contentSid === undefined) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      '"body" is required unless "contentSid" is provided.'
    );
  }

  const delivery = await ctx.client.messages.send({
    to,
    ...(channel ? { channel } : {}),
    ...(text ? { body: text } : {}),
    ...(mediaUrl ? { mediaUrl } : {}),
    ...(contentSid ? { contentSid } : {}),
    ...(contentVariables ? { contentVariables } : {}),
  });

  return json(200, delivery);
};

/** `POST /messages/agent` — the Agent composes the reply on the shared thread. */
export const sendAgentMessage: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const agentId = requireStringField(body, 'agentId');
  const to = requireStringField(body, 'to');
  const prompt = requireStringField(body, 'prompt');
  const channel = optionalChannel(body);
  const displayName = optionalStringField(body, 'displayName');

  const delivery = await ctx.client.messages.sendFromAgent({
    agentId,
    to,
    prompt,
    ...(channel ? { channel } : {}),
    ...(displayName ? { displayName } : {}),
  });

  return json(200, delivery);
};
