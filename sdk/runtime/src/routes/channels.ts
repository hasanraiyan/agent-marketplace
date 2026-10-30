import type { RouteHandler } from '../routing.js';
import type { RuntimeRequest } from '../types/request.js';
import type {
  TwilioChannelOptions,
  TwilioChannelRequest,
  TwilioChannelUser,
} from '../types/options.js';
import type { RuntimeBufferedResponse } from '../types/response.js';
import { RuntimeHttpError } from '../errors.js';

/**
 * Bring-your-own-Twilio-number channel webhooks.
 *
 * These are the only routes in this runtime that are `requiresAuth: false`
 * (besides `/health`): Twilio does not send an end-user session, it sends a
 * signature. Authentication is therefore two-step and entirely
 * host-configured: verify `X-Twilio-Signature` with the host's own auth
 * token, then resolve the sender to one of the host's users. Persona is
 * reached with the Project credential for that resolved user.
 *
 * Nothing here ever sends a message from Persona's Twilio account, and the
 * voice path only mints a ticket — the audio stream goes from Twilio
 * straight to Persona.
 */

const SIGNATURE_HEADER = 'x-twilio-signature';

const DEFAULT_VOICE_FALLBACK =
  'Sorry, this assistant is unavailable right now. Please try again later.';
const DEFAULT_MESSAGE_FALLBACK =
  'Sorry, something went wrong while handling your message. Please try again.';

function firstHeader(value: string | undefined): string | undefined {
  return value?.split(',')[0]?.trim() || undefined;
}

/** Twilio signs the exact public URL, including the query string. */
export function resolveSignedUrl(
  request: RuntimeRequest,
  publicUrl?: string
): string | null {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(request.query)) {
    if (value !== undefined) search.set(key, value);
  }
  const query = search.toString();
  const pathWithQuery = request.path + (query ? `?${query}` : '');

  if (publicUrl) {
    return `${publicUrl.replace(/\/+$/, '')}${pathWithQuery}`;
  }

  const host =
    firstHeader(request.headers['x-forwarded-host']) ?? firstHeader(request.headers.host);
  const proto = firstHeader(request.headers['x-forwarded-proto']) ?? 'https';
  if (!host) return null;
  return `${proto}://${host}${pathWithQuery}`;
}

/** `base64(HMAC-SHA1(authToken, url + concat(sortedParamKeys + values)))`. */
export async function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>
): Promise<string> {
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join('');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyTwilioSignature(
  request: RuntimeRequest,
  options: TwilioChannelOptions
): Promise<boolean> {
  const provided = request.headers[SIGNATURE_HEADER];
  if (!provided || !options.authToken) return false;

  const url = resolveSignedUrl(request, options.publicUrl);
  if (!url) return false;

  const expected = await computeTwilioSignature(options.authToken, url, formParams(request));
  return constantTimeEqual(expected, provided);
}

/** Flattens a urlencoded body into Twilio's string-only param map. */
export function formParams(request: RuntimeRequest): Record<string, string> {
  const params: Record<string, string> = {};
  const body = request.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return params;

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value === 'string') params[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') params[key] = String(value);
  }
  return params;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** A 200 TwiML response — Twilio only executes TwiML on a 2xx. */
export function twiml(body: string): RuntimeBufferedResponse {
  return {
    kind: 'buffered',
    status: 200,
    headers: { 'content-type': 'text/xml; charset=utf-8' },
    body: `<?xml version="1.0" encoding="UTF-8"?>${body}`,
  };
}

function forbidden(message: string): RuntimeBufferedResponse {
  return {
    kind: 'buffered',
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: message,
  };
}

function channelKind(from: string): 'whatsapp' | 'sms' {
  return from.trim().toLowerCase().startsWith('whatsapp:') ? 'whatsapp' : 'sms';
}

function toUser(result: string | TwilioChannelUser | null): TwilioChannelUser | null {
  if (!result) return null;
  if (typeof result === 'string') return result ? { externalUserId: result } : null;
  if (typeof result.externalUserId !== 'string' || !result.externalUserId) return null;
  return result;
}

/**
 * Verifies the signature, then runs the host's resolver. Returns either the
 * resolved user or a response that must be returned immediately.
 */
async function authenticate(
  request: RuntimeRequest,
  options: TwilioChannelOptions,
  channelRequest: TwilioChannelRequest
): Promise<{ user: TwilioChannelUser } | { response: RuntimeBufferedResponse }> {
  if (!(await verifyTwilioSignature(request, options))) {
    return { response: forbidden('Invalid Twilio signature') };
  }

  let resolved: TwilioChannelUser | string | null = null;
  try {
    resolved = await options.resolveUser(channelRequest);
  } catch {
    resolved = null;
  }

  const user = toUser(resolved);
  if (!user) {
    // Unknown sender: end the call (voice) / send nothing (message). Never
    // reveal whether the number is known.
    return {
      response:
        channelRequest.channel === 'voice'
          ? twiml('<Response><Reject/></Response>')
          : twiml('<Response></Response>'),
    };
  }

  return { user };
}

/** `POST /channels/twilio/voice` — answer a call with a Persona media stream. */
export const twilioVoiceChannel: RouteHandler = async (request, ctx) => {
  const options = ctx.channels?.twilio;
  if (!options) {
    throw new RuntimeHttpError(404, 'NOT_FOUND', 'Twilio voice channel is not configured.');
  }

  const params = formParams(request);
  const channelRequest: TwilioChannelRequest = {
    channel: 'voice',
    from: params.From ?? '',
    to: params.To ?? '',
    ...(params.CallSid ? { callSid: params.CallSid } : {}),
  };

  const auth = await authenticate(request, options, channelRequest);
  if ('response' in auth) return auth.response;

  const agentId = auth.user.agentId ?? options.agentId;
  const fallback = options.voiceFallback ?? DEFAULT_VOICE_FALLBACK;

  if (!agentId) {
    ctx.logger.warn('twilio voice channel has no agent configured', {
      hasDefault: false,
      resolverProvided: false,
    });
    return twiml(`<Response><Say>${escapeXml(fallback)}</Say><Hangup/></Response>`);
  }

  try {
    const session = await ctx.client.voice.createTelephonySession({
      agentId,
      externalUserId: auth.user.externalUserId,
      ...(auth.user.threadId ? { threadId: auth.user.threadId } : {}),
      ...(channelRequest.from ? { from: channelRequest.from } : {}),
      ...(channelRequest.to ? { to: channelRequest.to } : {}),
      ...(channelRequest.callSid ? { callSid: channelRequest.callSid } : {}),
    });

    await ctx.hooks?.onVoiceSessionCreate?.({
      userId: auth.user.externalUserId,
      agentId,
    });

    return twiml(
      `<Response><Connect><Stream url="${escapeXml(session.streamUrl)}"/></Connect></Response>`
    );
  } catch (err) {
    ctx.logger.error('twilio voice channel failed to start a session', {
      error: err instanceof Error ? err.message : String(err),
    });
    return twiml(`<Response><Say>${escapeXml(fallback)}</Say><Hangup/></Response>`);
  }
};

/** `POST /channels/twilio/message` — reply to an SMS/WhatsApp message inline. */
export const twilioMessageChannel: RouteHandler = async (request, ctx) => {
  const options = ctx.channels?.twilio;
  if (!options) {
    throw new RuntimeHttpError(404, 'NOT_FOUND', 'Twilio messaging channel is not configured.');
  }

  const params = formParams(request);
  const channelRequest: TwilioChannelRequest = {
    channel: channelKind(params.From ?? ''),
    from: params.From ?? '',
    to: params.To ?? '',
    ...(params.MessageSid ? { messageSid: params.MessageSid } : {}),
    ...(params.Body ? { body: params.Body } : {}),
    ...(params.ProfileName ? { profileName: params.ProfileName } : {}),
  };

  const auth = await authenticate(request, options, channelRequest);
  if ('response' in auth) return auth.response;

  const agentId = auth.user.agentId ?? options.agentId;
  const fallback =
    options.messageFallback === undefined ? DEFAULT_MESSAGE_FALLBACK : options.messageFallback;

  if (!agentId) {
    ctx.logger.warn('twilio message channel has no agent configured');
    return fallback
      ? twiml(`<Response><Message>${escapeXml(fallback)}</Message></Response>`)
      : twiml('<Response></Response>');
  }

  const text = channelRequest.body ?? '';
  if (!text.trim()) {
    // Media-only or empty message: acknowledge with no reply rather than
    // paying for an agent turn on nothing.
    return twiml('<Response></Response>');
  }

  try {
    const result = await ctx.client.messages.generateReply({
      agentId,
      externalUserId: auth.user.externalUserId,
      text,
      ...(auth.user.threadId ? { threadId: auth.user.threadId } : {}),
      ...(channelRequest.profileName ? { displayName: channelRequest.profileName } : {}),
    });

    return twiml(`<Response><Message>${escapeXml(result.reply)}</Message></Response>`);
  } catch (err) {
    ctx.logger.error('twilio message channel failed to generate a reply', {
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback
      ? twiml(`<Response><Message>${escapeXml(fallback)}</Message></Response>`)
      : twiml('<Response></Response>');
  }
};
