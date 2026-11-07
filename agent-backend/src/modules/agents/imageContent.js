import { HumanMessage, ToolMessage } from '@langchain/core/messages';
import { createMiddleware } from 'langchain';
import fileRepository from '../files/file.repository.js';
import fileService from '../files/file.service.js';
import { IMAGE_INPUT_LIMITS } from '../agui/userContent.js';

/**
 * Prepares image content for one model call (runs inside agent.factory.js's
 * wrapModelCall, so the checkpoint itself is never changed):
 *
 * 1. User images are stored as references (`{ type: 'image', personaFileId }`,
 *    see agui/userContent.js). They are loaded and inlined here.
 * 2. Only images from the last N user turns go out as pictures; older ones —
 *    including images returned by tools such as deepagents' read_file —
 *    become a short text placeholder, so a long chat doesn't resend every
 *    image on every call.
 * 3. Provider format: LangChain's OpenAI converter passes a standard
 *    `{ type: 'image', data }` block through untouched on Chat Completions
 *    (OpenAI rejects it) and silently drops it on the Responses API, so
 *    OpenAI-compatible providers get `image_url` with a data URL instead.
 *    Anthropic and Gemini convert the standard block themselves.
 * 4. Tool results with images: Anthropic accepts them; OpenAI Chat
 *    Completions doesn't allow images in tool messages and Gemini would
 *    serialize them into the JSON function response, so for those the image
 *    is replaced by a note and re-sent in a user message placed right after
 *    the run of tool messages (tool messages must directly follow their
 *    assistant tool call).
 */

const OPENAI_STYLE = new Set(['openai', 'custom', 'deepseek', 'ollama']);

const isType = (msg, type) => {
  const t = typeof msg?.getType === 'function' ? msg.getType() : (msg?._getType?.() ?? msg?.type);
  return t === type;
};

const isImagePart = (part) => part && typeof part === 'object' && part.type === 'image';
const isPersonaImage = (part) => isImagePart(part) && typeof part.personaFileId === 'string';

/** True when any message carries an image reference or a tool-result image. */
export function hasImageContent(messages) {
  return (messages || []).some(
    (msg) => Array.isArray(msg?.content) && msg.content.some((part) => isImagePart(part))
  );
}

/** Loads a stored attachment as base64. Returns null when it's gone. */
export async function loadStoredImage(fileId) {
  try {
    const file = await fileRepository.findById(fileId);
    if (!file) return null;
    const bytes = await fileService.readFileBytes(file);
    return { data: bytes.toString('base64'), mimeType: file.mimeType };
  } catch {
    return null;
  }
}

function toProviderImage({ data, mimeType }, providerType) {
  if (OPENAI_STYLE.has(providerType)) {
    return { type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` } };
  }
  return { type: 'image', mimeType, data };
}

function imageLabel(part) {
  return part.name || part.personaFileId || part.mimeType || 'image';
}

function placeholder(part, reason) {
  const where = part.personaFileId ? ' (still in /uploads/ if you need it)' : '';
  return { type: 'text', text: `[image: ${imageLabel(part)} — ${reason}${where}]` };
}

function cloneWithContent(msg, content) {
  if (isType(msg, 'tool')) {
    return new ToolMessage({
      content,
      tool_call_id: msg.tool_call_id,
      id: msg.id,
      name: msg.name,
      status: msg.status,
      artifact: msg.artifact,
      additional_kwargs: { ...(msg.additional_kwargs || {}) },
      response_metadata: { ...(msg.response_metadata || {}) },
    });
  }
  return new HumanMessage({
    content,
    id: msg.id,
    name: msg.name,
    additional_kwargs: { ...(msg.additional_kwargs || {}) },
    response_metadata: { ...(msg.response_metadata || {}) },
  });
}

/**
 * @param {Array} messages             request.messages (not mutated)
 * @param {string} providerType        'openai' | 'anthropic' | 'gemini' | 'custom' | …
 * @param {{ loadImage?: (fileId: string) => Promise<{data: string, mimeType: string} | null>,
 *           recentUserTurns?: number }} [options]
 * @returns {Promise<Array>} messages ready for the provider
 */
export async function prepareImagesForModel(messages, providerType, options = {}) {
  const loadImage = options.loadImage || loadStoredImage;
  const recentUserTurns = options.recentUserTurns ?? IMAGE_INPUT_LIMITS.recentUserTurnsWithImages;
  if (!Array.isArray(messages) || !hasImageContent(messages)) return messages;

  // Images at or after this index go out as pictures.
  const humanIndexes = messages.flatMap((msg, i) => (isType(msg, 'human') ? [i] : []));
  const cutoff =
    humanIndexes.length > recentUserTurns ? humanIndexes[humanIndexes.length - recentUserTurns] : 0;
  const toolImagesStayInline = providerType === 'anthropic';

  const out = [];
  let movedFromTools = [];
  const flushMoved = () => {
    if (movedFromTools.length === 0) return;
    out.push(
      new HumanMessage({
        content: [
          { type: 'text', text: 'Images returned by the tool calls above:' },
          ...movedFromTools,
        ],
      })
    );
    movedFromTools = [];
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isTool = isType(msg, 'tool');
    if (!isTool) flushMoved();

    if (
      !(isTool || isType(msg, 'human')) ||
      !Array.isArray(msg?.content) ||
      !msg.content.some((part) => isImagePart(part))
    ) {
      out.push(msg);
      continue;
    }

    const recent = i >= cutoff;
    const content = [];
    for (const part of msg.content) {
      if (!isImagePart(part)) {
        content.push(part);
        continue;
      }
      if (!recent) {
        content.push(placeholder(part, 'shared earlier, not shown again'));
        continue;
      }

      let image = null;
      if (isPersonaImage(part)) {
        image = await loadImage(part.personaFileId);
        if (!image) {
          content.push({
            type: 'text',
            text: `[image: ${imageLabel(part)} — no longer available]`,
          });
          continue;
        }
      } else if (typeof part.data === 'string' && part.mimeType) {
        image = { data: part.data, mimeType: part.mimeType };
      } else {
        // URL-sourced or unrecognised image block: leave it for the provider.
        content.push(part);
        continue;
      }

      if (isTool && !toolImagesStayInline) {
        content.push({
          type: 'text',
          text: `[image: ${imageLabel(part)} — shown in the next message]`,
        });
        movedFromTools.push(toProviderImage(image, providerType));
      } else {
        content.push(toProviderImage(image, providerType));
      }
    }
    out.push(cloneWithContent(msg, content));
  }
  flushMoved();
  return out;
}

const VISION_ERROR_PATTERNS = [
  /does(?:n't| not) support (?:image|vision|multimodal)/i,
  /(?:image|vision|multimodal)[^.]{0,40}(?:not supported|unsupported|not enabled)/i,
  /unknown variant `?image_url/i,
  /image input is not supported/i,
  /invalid content type.{0,20}image/i,
  /model .{0,60}(?:is not|isn't) (?:a )?(?:vision|multimodal)/i,
];

/** True when a provider error means "this model can't take images". */
export function isVisionUnsupportedError(err) {
  const message = String(err?.message || err || '');
  return VISION_ERROR_PATTERNS.some((re) => re.test(message));
}

/** Provider family of a LangChain chat model, by class name (same rule as contextOverrideMiddleware). */
export function detectProviderType(model) {
  const modelId = model?.constructor?.name || '';
  if (modelId.includes('GoogleGenerativeAI') || modelId.includes('Gemini')) return 'gemini';
  if (modelId.includes('Anthropic') || modelId.includes('Claude')) return 'anthropic';
  if (modelId.includes('OpenAI') || modelId.includes('DeepSeek')) return 'openai';
  return 'custom';
}

/**
 * Model-call middleware: a no-op unless a message has an image. Never
 * changes the checkpoint — only the request for this one call. Turns
 * "this model can't read images" provider errors into MODEL_NO_VISION.
 */
export function createImageContentMiddleware({
  loadImage,
  detectProvider = detectProviderType,
} = {}) {
  return createMiddleware({
    name: 'ImageContentMiddleware',
    async wrapModelCall(request, handler) {
      const messages = Array.isArray(request.messages) ? request.messages : [];
      if (!hasImageContent(messages)) return handler(request);

      const prepared = await prepareImagesForModel(messages, detectProvider(request.model), {
        loadImage,
      });
      try {
        return await handler({ ...request, messages: prepared });
      } catch (err) {
        if (isVisionUnsupportedError(err)) throw new ModelNoVisionError(err);
        throw err;
      }
    },
  });
}

export const imageContentMiddleware = createImageContentMiddleware();

export class ModelNoVisionError extends Error {
  constructor(cause) {
    super(
      "This agent's model can't read images. Choose a vision-capable model (e.g. GPT-4o/4.1, Claude, Gemini) or send text only."
    );
    this.name = 'ModelNoVisionError';
    this.code = 'MODEL_NO_VISION';
    this.cause = cause;
  }
}
