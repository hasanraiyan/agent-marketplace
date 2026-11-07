import fileService from '../files/file.service.js';
import {
  AttachmentError,
  IMAGE_INPUT_LIMITS,
  checkImageBytes,
  decodeBase64,
} from '../agui/userContent.js';

/**
 * Image input during a live voice call (the Agent's `imageInputEnabled`).
 *
 * The client sends `{ type: 'voice.image', id, data | fileId, mimeType?, name?, text? }`
 * over the voice WebSocket. Gemini Live takes a still image as one video
 * frame (`sendRealtimeInput({ video })`), JPEG or PNG, at most one per
 * second — so voice is stricter than text chat (no WebP/GIF, rate limited,
 * capped per call). Clients are expected to shrink images before sending
 * (`@personaai/react`'s `useVoice().sendImage` re-encodes to JPEG).
 */
export const VOICE_IMAGE_LIMITS = Object.freeze({
  mimeTypes: Object.freeze(['image/jpeg', 'image/png']),
  maxImageBytes: IMAGE_INPUT_LIMITS.maxImageBytes,
  minIntervalMs: 1000,
  maxImagesPerCall: 20,
});

/** Text sent after an image that came without a caption, so the model answers it. */
export const UNCAPTIONED_IMAGE_PROMPT = '(The user just shared an image. Look at it and respond.)';

/** Prompt section appended to the Live systemInstruction when image input is on. */
export const VOICE_IMAGE_PROMPT_SECTION =
  '### USER IMAGES\nDuring this call the user can share images (photos, screenshots). ' +
  'When one arrives, look at it and use what it shows in your spoken answer. ' +
  'Describe only what is actually visible; say so if it is unclear.';

export class VoiceImageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'VoiceImageError';
    this.code = code;
  }
}

function stripDataUrl(data) {
  const match = /^data:[^;,]+;base64,(.*)$/s.exec(data);
  return match ? match[1] : data;
}

/**
 * Validates one `voice.image` message and returns the bytes for Gemini plus
 * (when `persist` is set) a stored file reference for the thread checkpoint.
 *
 * @param {object} msg - the client message
 * @param {object} opts
 * @param {{domain: string, externalUserId: string}|null} opts.subject - file owner
 * @param {string} [opts.agentId]
 * @param {boolean} [opts.persist] - store inline images as attachment files
 * @param {object} [opts.files] - fileService (injectable for tests)
 * @returns {Promise<{ buffer: Buffer, mimeType: string, ref: {fileId: string, mimeType: string, name: string, size: number}|null }>}
 */
export async function resolveVoiceImage(
  msg,
  { subject, agentId, persist = false, files = fileService } = {}
) {
  let buffer;
  let ref = null;
  try {
    if (typeof msg?.fileId === 'string' && msg.fileId) {
      if (!subject) throw new AttachmentError('Sign in to send images.');
      const file = await files.getOwnedFile(msg.fileId, subject);
      if (!file) throw new AttachmentError(`Attachment "${msg.fileId}" was not found.`);
      if (file.size > VOICE_IMAGE_LIMITS.maxImageBytes) {
        throw new AttachmentError('Image is too large.');
      }
      try {
        buffer = await files.readFileBytes(file);
      } catch {
        throw new AttachmentError(`Attachment "${msg.fileId}" is no longer available.`);
      }
      const mimeType = checkImageBytes(buffer);
      ref = { fileId: String(file._id), mimeType, name: file.originalName, size: buffer.length };
    } else if (typeof msg?.data === 'string' && msg.data) {
      buffer = decodeBase64(stripDataUrl(msg.data));
    } else {
      throw new AttachmentError('voice.image needs "data" (base64) or "fileId".');
    }
  } catch (err) {
    if (err instanceof AttachmentError) throw new VoiceImageError(err.code, err.message);
    throw err;
  }

  let mimeType;
  try {
    mimeType = checkImageBytes(buffer);
  } catch (err) {
    throw new VoiceImageError('INVALID_ATTACHMENT', err.message);
  }
  if (!VOICE_IMAGE_LIMITS.mimeTypes.includes(mimeType)) {
    throw new VoiceImageError(
      'INVALID_ATTACHMENT',
      `Voice calls accept ${VOICE_IMAGE_LIMITS.mimeTypes.join(' or ')} images (got ${mimeType}).`
    );
  }

  if (!ref && persist && subject) {
    const name = typeof msg.name === 'string' ? msg.name : undefined;
    const file = await files.createAttachmentFromBuffer(subject, {
      buffer,
      mimeType,
      name,
      agentId,
    });
    ref = { fileId: String(file._id), mimeType, name: file.originalName, size: buffer.length };
  }

  return { buffer, mimeType, ref };
}
