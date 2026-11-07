import { PERSONA_DOMAIN } from '../auth/personaPrincipalContext.js';
import fileService from '../files/file.service.js';

/**
 * Image input on end-user messages (the Agent's `imageInputEnabled`).
 *
 * The run input's last user message may carry content parts instead of a
 * plain string. Accepted image parts:
 *   - `{ type: 'image', fileId }`                       Persona: a file uploaded via /files
 *   - `{ type: 'image', source: { type: 'data', value, mimeType } }`  AG-UI inline base64
 *   - `{ type: 'image', source: { type: 'url', value } }`             AG-UI URL (allowlisted hosts only)
 *   - `{ type: 'binary', mimeType: 'image/*', id | data | url }`     AG-UI legacy binary part
 *   - `{ type: 'image_url', image_url: { url } }`                    OpenAI-style (data: or https:)
 *
 * Every image is checked (real type from its bytes, size, count, ownership)
 * and stored as a file record; the HumanMessage persisted in the checkpoint
 * only references it by id (`{ type: 'image', personaFileId }`), so
 * checkpoints never carry base64. agents/imageContent.js turns those
 * references into real image data right before each model call.
 */

export const IMAGE_INPUT_LIMITS = Object.freeze({
  maxImagesPerMessage: 4,
  maxImageBytes: 5 * 1024 * 1024,
  // Images in the last N user turns go to the model as pictures; older ones
  // become a one-line placeholder (they stay readable from /uploads/).
  recentUserTurnsWithImages: 2,
  urlFetchTimeoutMs: 10_000,
});

export const ALLOWED_IMAGE_MIME_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export class AttachmentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AttachmentError';
    this.code = 'INVALID_ATTACHMENT';
  }
}

/** Detects the image type from its first bytes; null if it's none of the allowed ones. */
export function sniffImageMime(bytes) {
  if (!bytes || bytes.length < 12) return null;
  const b = bytes;
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  const ascii = (start, end) => String.fromCharCode(...b.subarray(start, end));
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** The last `role: 'user'` message of an AG-UI messages array. */
export function getLastUserMessage(messages) {
  return [...(messages || [])].reverse().find((message) => message?.role === 'user');
}

const DATA_URL_RE = /^data:([\w/+.-]+)?(;[\w-]+=[\w-]+)*;base64,(.*)$/s;

function imageFromUrlString(url, name) {
  if (typeof url !== 'string' || !url) return null;
  const dataMatch = DATA_URL_RE.exec(url);
  if (dataMatch) return { source: 'data', data: dataMatch[3], name };
  return { source: 'url', url, name };
}

/**
 * Splits a user message's content into its text and image references.
 * Unknown part types are ignored; non-image binary parts are counted in
 * `unsupported` so the caller can tell the model something was left out.
 *
 * @returns {{ text: string, images: Array<object>, unsupported: string[] }}
 */
export function parseUserContent(content) {
  if (typeof content === 'string') return { text: content, images: [], unsupported: [] };
  if (!Array.isArray(content)) return { text: '', images: [], unsupported: [] };

  const texts = [];
  const images = [];
  const unsupported = [];

  for (const part of content) {
    if (typeof part === 'string') {
      texts.push(part);
      continue;
    }
    if (!part || typeof part !== 'object') continue;
    const name =
      typeof part.filename === 'string'
        ? part.filename
        : typeof part.name === 'string'
          ? part.name
          : undefined;

    switch (part.type) {
      case 'text':
        if (typeof part.text === 'string') texts.push(part.text);
        break;
      case 'image': {
        if (typeof part.fileId === 'string') {
          images.push({ source: 'file', fileId: part.fileId, name });
        } else if (part.source?.type === 'data' && typeof part.source.value === 'string') {
          const value = part.source.value;
          images.push(
            value.startsWith('data:')
              ? imageFromUrlString(value, name)
              : { source: 'data', data: value, name }
          );
        } else if (
          part.source?.type === 'url' &&
          typeof part.source.value === 'string' &&
          part.source.value
        ) {
          images.push(imageFromUrlString(part.source.value, name));
        } else {
          throw new AttachmentError(
            'Image part needs a fileId or a source of type "data" or "url".'
          );
        }
        break;
      }
      case 'image_url': {
        const url = typeof part.image_url === 'string' ? part.image_url : part.image_url?.url;
        const image = imageFromUrlString(url, name);
        if (!image) throw new AttachmentError('image_url part has no url.');
        images.push(image);
        break;
      }
      case 'binary': {
        const mimeType = typeof part.mimeType === 'string' ? part.mimeType : '';
        if (!mimeType.startsWith('image/')) {
          unsupported.push(mimeType || 'unknown');
          break;
        }
        if (typeof part.id === 'string') images.push({ source: 'file', fileId: part.id, name });
        else if (typeof part.data === 'string')
          images.push({ source: 'data', data: part.data, name });
        else if (typeof part.url === 'string') images.push(imageFromUrlString(part.url, name));
        else throw new AttachmentError('Binary image part needs an id, data or url.');
        break;
      }
      case 'audio':
      case 'video':
      case 'document':
      case 'file':
        unsupported.push(part.type);
        break;
      default:
        break;
    }
  }

  return { text: texts.join(''), images, unsupported };
}

/**
 * Who owns attachments sent in this run. Developer runtime callers have a
 * real external user; Persona users and Project-internal callers (agent
 * test chat) get a synthetic subject in their own Domain, so their inline
 * images are stored and checked the same way. Null when there is nobody to
 * own a file (an anonymous guest).
 */
export function attachmentSubject(executionContext, userId) {
  const ctx = executionContext || {};
  if (ctx.principalType === 'ProjectRuntime' && ctx.domain && ctx.externalUserId) {
    return { domain: ctx.domain, externalUserId: String(ctx.externalUserId) };
  }
  const principal = ctx.personaUserId || ctx.userId || userId;
  if (!principal) return null;
  const domain = ctx.domain || PERSONA_DOMAIN;
  return {
    domain,
    externalUserId: `internal:${ctx.principalType || 'user'}:${String(principal)}`,
  };
}

export function decodeBase64(data) {
  const clean = data.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) && !/^[A-Za-z0-9_-]*={0,2}$/.test(clean)) {
    throw new AttachmentError('Image data is not valid base64.');
  }
  // Size check before decoding, so an oversized payload is never allocated.
  if (Math.floor((clean.length * 3) / 4) > IMAGE_INPUT_LIMITS.maxImageBytes + 3) {
    throw new AttachmentError(tooLargeMessage());
  }
  return Buffer.from(clean, clean.includes('-') || clean.includes('_') ? 'base64url' : 'base64');
}

function tooLargeMessage() {
  return `Image is larger than ${IMAGE_INPUT_LIMITS.maxImageBytes / (1024 * 1024)} MB.`;
}

export function checkImageBytes(buffer) {
  if (buffer.length > IMAGE_INPUT_LIMITS.maxImageBytes)
    throw new AttachmentError(tooLargeMessage());
  const mimeType = sniffImageMime(buffer);
  if (!mimeType) {
    throw new AttachmentError(
      `Unsupported image type. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}.`
    );
  }
  return mimeType;
}

/** Hosts image URLs may be fetched from (IMAGE_INPUT_URL_HOSTS, comma separated). Empty = URLs refused. */
export function allowedImageUrlHosts(env = process.env) {
  return (env.IMAGE_INPUT_URL_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

async function fetchImageUrl(rawUrl, { fetchImpl, allowedHosts }) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AttachmentError('Image URL is not valid.');
  }
  if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new AttachmentError(
      'Image URLs are not accepted here; upload the file or send it inline.'
    );
  }
  let response;
  try {
    response = await fetchImpl(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(IMAGE_INPUT_LIMITS.urlFetchTimeoutMs),
    });
  } catch {
    throw new AttachmentError('Could not download the image URL.');
  }
  if (!response.ok) throw new AttachmentError(`Image URL returned HTTP ${response.status}.`);
  const declared = Number(response.headers?.get?.('content-length'));
  if (declared > IMAGE_INPUT_LIMITS.maxImageBytes) throw new AttachmentError(tooLargeMessage());

  // Stream with a hard cap — content-length can be absent or wrong.
  const chunks = [];
  let total = 0;
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > IMAGE_INPUT_LIMITS.maxImageBytes)
      throw new AttachmentError(tooLargeMessage());
    return buffer;
  }
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > IMAGE_INPUT_LIMITS.maxImageBytes) {
      await reader.cancel().catch(() => {});
      throw new AttachmentError(tooLargeMessage());
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Validates and stores the parsed images; returns file references in order.
 * Throws AttachmentError on the first invalid image (nothing partial is used).
 *
 * @returns {Promise<Array<{ fileId: string, mimeType: string, name: string, size: number }>>}
 */
export async function resolveUserImages(
  images,
  { subject, agentId, files = fileService, fetchImpl = globalThis.fetch, env = process.env } = {}
) {
  if (!images?.length) return [];
  if (images.length > IMAGE_INPUT_LIMITS.maxImagesPerMessage) {
    throw new AttachmentError(
      `At most ${IMAGE_INPUT_LIMITS.maxImagesPerMessage} images per message.`
    );
  }
  if (!subject) throw new AttachmentError('Sign in to send images.');

  const allowedHosts = allowedImageUrlHosts(env);
  const refs = [];
  for (const image of images) {
    if (image.source === 'file') {
      const file = await files.getOwnedFile(image.fileId, subject);
      if (!file) throw new AttachmentError(`Attachment "${image.fileId}" was not found.`);
      if (file.size > IMAGE_INPUT_LIMITS.maxImageBytes)
        throw new AttachmentError(tooLargeMessage());
      let bytes;
      try {
        bytes = await files.readFileBytes(file);
      } catch {
        throw new AttachmentError(`Attachment "${image.fileId}" is no longer available.`);
      }
      const mimeType = checkImageBytes(bytes);
      refs.push({
        fileId: String(file._id),
        mimeType,
        name: file.originalName,
        size: bytes.length,
      });
      continue;
    }

    const buffer =
      image.source === 'data'
        ? decodeBase64(image.data)
        : await fetchImageUrl(image.url, { fetchImpl, allowedHosts });
    const mimeType = checkImageBytes(buffer);
    const file = await files.createAttachmentFromBuffer(subject, {
      buffer,
      mimeType,
      name: image.name,
      agentId,
    });
    refs.push({ fileId: String(file._id), mimeType, name: file.originalName, size: buffer.length });
  }
  return refs;
}

/** HumanMessage content for a turn: the plain string when there are no images. */
export function buildHumanContent(text, refs) {
  if (!refs?.length) return text;
  return [
    ...(text ? [{ type: 'text', text }] : []),
    ...refs.map((ref) => ({
      type: 'image',
      mimeType: ref.mimeType,
      personaFileId: ref.fileId,
      name: ref.name,
    })),
  ];
}

/** Text appended for images/attachments the agent won't see. */
export function droppedAttachmentNotice({ images = 0, unsupported = [] } = {}) {
  const notes = [];
  if (images > 0) {
    notes.push(
      `[${images} image${images === 1 ? '' : 's'} attached — this agent can't view images]`
    );
  }
  if (unsupported.length > 0) {
    notes.push(
      `[${unsupported.length} attachment${unsupported.length === 1 ? '' : 's'} of an unsupported type (${[...new Set(unsupported)].join(', ')}) left out]`
    );
  }
  return notes.join('\n');
}

/** Attachments of a persisted HumanMessage's content, for thread history. */
export function extractAttachments(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter((part) => part?.type === 'image' && typeof part.personaFileId === 'string')
    .map((part) => ({
      fileId: part.personaFileId,
      mimeType: part.mimeType,
      ...(part.name ? { name: part.name } : {}),
    }));
}
