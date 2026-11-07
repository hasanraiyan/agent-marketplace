import { jest } from '@jest/globals';
import { HumanMessage, AIMessage, AIMessageChunk, ToolMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGenerationChunk } from '@langchain/core/outputs';
import { MemorySaver } from '@langchain/langgraph';
import { createAgent } from 'langchain';
import {
  AttachmentError,
  IMAGE_INPUT_LIMITS,
  attachmentSubject,
  buildHumanContent,
  extractAttachments,
  parseUserContent,
  resolveUserImages,
  sniffImageMime,
} from '../src/modules/agui/userContent.js';
import {
  createImageContentMiddleware,
  detectProviderType,
  isVisionUnsupportedError,
  prepareImagesForModel,
} from '../src/modules/agents/imageContent.js';
import { buildTurnContent } from '../src/modules/agui/agui.service.js';
import {
  classifyRuntimeError,
  extractToolOutputContent,
} from '../src/modules/agui/aguiTranslator.js';
import { sanitizeMessageForModel } from '../src/modules/agents/sanitizeMessagesForModel.js';
import { createAttachmentsBackend, attachmentKey } from '../src/modules/files/attachmentsBackend.js';

// ── fixtures ────────────────────────────────────────────────────────────────
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const GIF = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00', 'latin1');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([8, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const TEXT = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const b64 = (buf) => buf.toString('base64');

const SUBJECT = { domain: 'project:1', externalUserId: 'user-1' };

function fakeFiles(initial = []) {
  const records = new Map(initial.map((f) => [String(f._id), f]));
  const bytes = new Map(initial.map((f) => [String(f._id), f.bytes]));
  let seq = 0;
  return {
    records,
    created: [],
    async getOwnedFile(id, subject) {
      const f = records.get(id);
      return f && f.domain === subject.domain && f.externalUserId === subject.externalUserId
        ? f
        : null;
    },
    async readFileBytes(file) {
      const b = bytes.get(String(file._id));
      if (!b) throw new Error('ENOENT');
      return b;
    },
    async createAttachmentFromBuffer(subject, { buffer, mimeType, name }) {
      const _id = `new${++seq}`;
      const rec = {
        _id,
        ...subject,
        mimeType,
        originalName: name || 'image.png',
        size: buffer.length,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      };
      records.set(_id, rec);
      bytes.set(_id, buffer);
      this.created.push(rec);
      return rec;
    },
  };
}

// ── userContent ─────────────────────────────────────────────────────────────
describe('sniffImageMime', () => {
  test('recognizes the four allowed types from their bytes', () => {
    expect(sniffImageMime(PNG)).toBe('image/png');
    expect(sniffImageMime(JPEG)).toBe('image/jpeg');
    expect(sniffImageMime(GIF)).toBe('image/gif');
    expect(sniffImageMime(WEBP)).toBe('image/webp');
  });
  test('rejects SVG, text and tiny buffers', () => {
    expect(sniffImageMime(TEXT)).toBeNull();
    expect(sniffImageMime(Buffer.from([0x89, 0x50]))).toBeNull();
    expect(sniffImageMime(null)).toBeNull();
  });
});

describe('parseUserContent', () => {
  test('plain string is text only', () => {
    expect(parseUserContent('hi')).toEqual({ text: 'hi', images: [], unsupported: [] });
  });

  test('accepts every supported image part shape', () => {
    const parsed = parseUserContent([
      { type: 'text', text: 'look ' },
      { type: 'image', fileId: 'f1', name: 'a.png' },
      { type: 'image', source: { type: 'data', value: b64(PNG), mimeType: 'image/png' } },
      { type: 'image', source: { type: 'data', value: `data:image/png;base64,${b64(PNG)}` } },
      { type: 'image', source: { type: 'url', value: 'https://cdn.example.com/x.png' } },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64(JPEG)}` } },
      { type: 'binary', mimeType: 'image/png', id: 'f2' },
      'here',
    ]);
    expect(parsed.text).toBe('look here');
    expect(parsed.images).toEqual([
      { source: 'file', fileId: 'f1', name: 'a.png' },
      { source: 'data', data: b64(PNG), name: undefined },
      { source: 'data', data: b64(PNG), name: undefined },
      { source: 'url', url: 'https://cdn.example.com/x.png', name: undefined },
      { source: 'data', data: b64(JPEG), name: undefined },
      { source: 'file', fileId: 'f2', name: undefined },
    ]);
  });

  test('non-image attachments are reported as unsupported, not dropped silently', () => {
    const parsed = parseUserContent([
      { type: 'binary', mimeType: 'application/pdf', id: 'x' },
      { type: 'audio', source: { type: 'data', value: 'AA', mimeType: 'audio/wav' } },
    ]);
    expect(parsed.images).toEqual([]);
    expect(parsed.unsupported).toEqual(['application/pdf', 'audio']);
  });

  test('a malformed image part is an AttachmentError', () => {
    expect(() => parseUserContent([{ type: 'image' }])).toThrow(AttachmentError);
    expect(() => parseUserContent([{ type: 'image_url', image_url: {} }])).toThrow(AttachmentError);
  });
});

describe('attachmentSubject', () => {
  test('runtime external user owns their own files', () => {
    expect(
      attachmentSubject({ principalType: 'ProjectRuntime', domain: 'project:1', externalUserId: 'u' })
    ).toEqual({ domain: 'project:1', externalUserId: 'u' });
  });
  test('persona user gets a synthetic subject that cannot be an external id of another domain', () => {
    expect(
      attachmentSubject({ principalType: 'PersonaUser', domain: 'persona', personaUserId: 'p1' })
    ).toEqual({ domain: 'persona', externalUserId: 'internal:PersonaUser:p1' });
  });
  test('anonymous guest has no subject', () => {
    expect(attachmentSubject({ principalType: 'PersonaUser', domain: 'persona' }, null)).toBeNull();
  });
});

describe('resolveUserImages', () => {
  test('stores inline images and references owned uploads; type comes from bytes', async () => {
    const files = fakeFiles([
      { _id: 'up1', ...SUBJECT, originalName: 'photo.jpg', mimeType: 'image/png', size: JPEG.length, bytes: JPEG },
    ]);
    const refs = await resolveUserImages(
      [
        { source: 'file', fileId: 'up1' },
        { source: 'data', data: b64(PNG), name: 'shot.png' },
      ],
      { subject: SUBJECT, files }
    );
    // Declared image/png on the upload, real bytes are JPEG: bytes win.
    expect(refs).toEqual([
      { fileId: 'up1', mimeType: 'image/jpeg', name: 'photo.jpg', size: JPEG.length },
      { fileId: 'new1', mimeType: 'image/png', name: 'shot.png', size: PNG.length },
    ]);
    expect(files.created).toHaveLength(1);
  });

  test("another user's file id is not found", async () => {
    const files = fakeFiles([
      { _id: 'up1', domain: 'project:1', externalUserId: 'someone-else', originalName: 'x', size: 4, bytes: PNG },
    ]);
    await expect(
      resolveUserImages([{ source: 'file', fileId: 'up1' }], { subject: SUBJECT, files })
    ).rejects.toThrow(/not found/);
  });

  test('rejects wrong type, oversize, too many, bad base64, no subject', async () => {
    const files = fakeFiles();
    await expect(
      resolveUserImages([{ source: 'data', data: b64(TEXT) }], { subject: SUBJECT, files })
    ).rejects.toThrow(/Unsupported image type/);

    const big = Buffer.alloc(IMAGE_INPUT_LIMITS.maxImageBytes + 10);
    PNG.copy(big);
    await expect(
      resolveUserImages([{ source: 'data', data: b64(big) }], { subject: SUBJECT, files })
    ).rejects.toThrow(/larger than/);

    const many = Array.from({ length: IMAGE_INPUT_LIMITS.maxImagesPerMessage + 1 }, () => ({
      source: 'data',
      data: b64(PNG),
    }));
    await expect(resolveUserImages(many, { subject: SUBJECT, files })).rejects.toThrow(/At most/);

    await expect(
      resolveUserImages([{ source: 'data', data: '%%%not base64%%%' }], { subject: SUBJECT, files })
    ).rejects.toThrow(/base64/);

    await expect(
      resolveUserImages([{ source: 'data', data: b64(PNG) }], { subject: null, files })
    ).rejects.toThrow(/Sign in/);
    expect(files.created).toHaveLength(0);
  });

  test('image URLs are refused unless the host is allowlisted, and https only', async () => {
    const files = fakeFiles();
    const fetchImpl = jest.fn(async () => new Response(PNG, { status: 200 }));

    await expect(
      resolveUserImages([{ source: 'url', url: 'https://cdn.example.com/a.png' }], {
        subject: SUBJECT,
        files,
        fetchImpl,
        env: {},
      })
    ).rejects.toThrow(/not accepted/);
    await expect(
      resolveUserImages([{ source: 'url', url: 'http://cdn.example.com/a.png' }], {
        subject: SUBJECT,
        files,
        fetchImpl,
        env: { IMAGE_INPUT_URL_HOSTS: 'cdn.example.com' },
      })
    ).rejects.toThrow(/not accepted/);
    await expect(
      resolveUserImages([{ source: 'url', url: 'https://169.254.169.254/latest' }], {
        subject: SUBJECT,
        files,
        fetchImpl,
        env: { IMAGE_INPUT_URL_HOSTS: 'cdn.example.com' },
      })
    ).rejects.toThrow(/not accepted/);
    expect(fetchImpl).not.toHaveBeenCalled();

    const refs = await resolveUserImages([{ source: 'url', url: 'https://cdn.example.com/a.png' }], {
      subject: SUBJECT,
      files,
      fetchImpl,
      env: { IMAGE_INPUT_URL_HOSTS: 'cdn.example.com' },
    });
    expect(refs[0].mimeType).toBe('image/png');
    expect(fetchImpl.mock.calls[0][1].redirect).toBe('error');
  });
});

describe('buildTurnContent', () => {
  const message = (content) => ({ role: 'user', content });

  test('text-only messages are unchanged', async () => {
    const resolve = jest.fn();
    expect(
      await buildTurnContent({ lastUserMessage: message('hi'), text: 'hi', imagesAllowed: true, resolve })
    ).toBe('hi');
    expect(resolve).not.toHaveBeenCalled();
  });

  test('setting off: images dropped, model told why, nothing stored', async () => {
    const resolve = jest.fn();
    const content = await buildTurnContent({
      lastUserMessage: message([{ type: 'text', text: 'what is this?' }, { type: 'image', fileId: 'f' }]),
      text: 'what is this?',
      imagesAllowed: false,
      resolve,
    });
    expect(content).toBe("what is this?\n\n[1 image attached — this agent can't view images]");
    expect(resolve).not.toHaveBeenCalled();
  });

  test('setting on: images stored as references and bound to the thread', async () => {
    const resolve = jest.fn(async () => [
      { fileId: 'f9', mimeType: 'image/png', name: 'a.png', size: 4 },
    ]);
    const bind = jest.fn();
    const content = await buildTurnContent({
      lastUserMessage: message([{ type: 'text', text: 'see' }, { type: 'image', fileId: 'f9' }]),
      text: 'see',
      imagesAllowed: true,
      subject: SUBJECT,
      threadKey: 'thread-1',
      resolve,
      bind,
    });
    expect(content).toEqual([
      { type: 'text', text: 'see' },
      { type: 'image', mimeType: 'image/png', personaFileId: 'f9', name: 'a.png' },
    ]);
    expect(bind).toHaveBeenCalledWith(['f9'], 'thread-1');
    // No base64 is ever persisted in the message.
    expect(JSON.stringify(content)).not.toMatch(/base64|data:/);
    expect(extractAttachments(content)).toEqual([
      { fileId: 'f9', mimeType: 'image/png', name: 'a.png' },
    ]);
  });
});

// ── imageContent (model call) ───────────────────────────────────────────────
describe('prepareImagesForModel', () => {
  const ref = (id) => ({ type: 'image', mimeType: 'image/png', personaFileId: id, name: `${id}.png` });
  const loadImage = async (id) => (id === 'gone' ? null : { data: `B64_${id}`, mimeType: 'image/png' });

  test('OpenAI-style providers get image_url data URLs; checkpoint messages untouched', async () => {
    const original = [new HumanMessage({ content: [{ type: 'text', text: 'hi' }, ref('a')] })];
    const out = await prepareImagesForModel(original, 'openai', { loadImage });
    expect(out[0].content).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,B64_a' } },
    ]);
    expect(original[0].content[1]).toEqual(ref('a'));
  });

  test('Anthropic and Gemini get the standard image block', async () => {
    for (const provider of ['anthropic', 'gemini']) {
      const out = await prepareImagesForModel([new HumanMessage({ content: [ref('a')] })], provider, {
        loadImage,
      });
      expect(out[0].content).toEqual([{ type: 'image', mimeType: 'image/png', data: 'B64_a' }]);
    }
  });

  test('only the last N user turns carry pictures; a missing file becomes a note', async () => {
    const msgs = [
      new HumanMessage({ content: [ref('old')] }),
      new AIMessage('ok'),
      new HumanMessage({ content: [ref('gone')] }),
      new AIMessage('ok'),
      new HumanMessage({ content: [ref('new')] }),
    ];
    const out = await prepareImagesForModel(msgs, 'anthropic', { loadImage, recentUserTurns: 2 });
    expect(out[0].content[0]).toEqual({
      type: 'text',
      text: '[image: old.png — shared earlier, not shown again (still in /uploads/ if you need it)]',
    });
    expect(out[2].content[0]).toEqual({ type: 'text', text: '[image: gone.png — no longer available]' });
    expect(out[4].content[0]).toEqual({ type: 'image', mimeType: 'image/png', data: 'B64_new' });
  });

  test('tool-result images move to a user message after the whole run of tool messages (OpenAI)', async () => {
    const img = { type: 'image', mimeType: 'image/png', data: 'TOOLIMG' };
    const msgs = [
      new HumanMessage('read both'),
      new AIMessage({
        content: '',
        tool_calls: [
          { id: 't1', name: 'read_file', args: {} },
          { id: 't2', name: 'read_file', args: {} },
        ],
      }),
      new ToolMessage({ tool_call_id: 't1', content: [img] }),
      new ToolMessage({ tool_call_id: 't2', content: [img] }),
      new AIMessage('done'),
    ];
    const out = await prepareImagesForModel(msgs, 'openai', { loadImage });
    expect(out.map((m) => m.getType())).toEqual(['human', 'ai', 'tool', 'tool', 'human', 'ai']);
    expect(out[2].content).toEqual([
      { type: 'text', text: '[image: image/png — shown in the next message]' },
    ]);
    expect(out[2].tool_call_id).toBe('t1');
    expect(out[4].content.slice(1)).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,TOOLIMG' } },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,TOOLIMG' } },
    ]);
  });

  test('Anthropic keeps tool-result images inline; Gemini moves them', async () => {
    const msgs = () => [
      new HumanMessage('read'),
      new AIMessage({ content: '', tool_calls: [{ id: 't1', name: 'read_file', args: {} }] }),
      new ToolMessage({ tool_call_id: 't1', content: [{ type: 'image', mimeType: 'image/png', data: 'X' }] }),
    ];
    const anthropic = await prepareImagesForModel(msgs(), 'anthropic', { loadImage });
    expect(anthropic).toHaveLength(3);
    expect(anthropic[2].content).toEqual([{ type: 'image', mimeType: 'image/png', data: 'X' }]);

    const gemini = await prepareImagesForModel(msgs(), 'gemini', { loadImage });
    expect(gemini.map((m) => m.getType())).toEqual(['human', 'ai', 'tool', 'human']);
  });

  test('no images: same array returned', async () => {
    const msgs = [new HumanMessage('hi')];
    expect(await prepareImagesForModel(msgs, 'openai', { loadImage })).toBe(msgs);
  });
});

describe('provider detection and vision errors', () => {
  test('detectProviderType by class name', () => {
    class ChatOpenAI {}
    class ChatAnthropic {}
    class ChatGoogleGenerativeAI {}
    class Whatever {}
    expect(detectProviderType(new ChatOpenAI())).toBe('openai');
    expect(detectProviderType(new ChatAnthropic())).toBe('anthropic');
    expect(detectProviderType(new ChatGoogleGenerativeAI())).toBe('gemini');
    expect(detectProviderType(new Whatever())).toBe('custom');
  });

  test('recognizes common "no vision" provider errors only', () => {
    expect(isVisionUnsupportedError(new Error('400 This model does not support image input'))).toBe(true);
    expect(isVisionUnsupportedError(new Error('unknown variant `image_url`, expected `text`'))).toBe(true);
    expect(isVisionUnsupportedError(new Error('Image input is not supported for this model'))).toBe(true);
    expect(isVisionUnsupportedError(new Error('429 rate limit'))).toBe(false);
    expect(isVisionUnsupportedError(new Error('invalid api key'))).toBe(false);
  });
});

// ── through a real langchain agent ──────────────────────────────────────────
describe('image content through a real langchain agent (createAgent)', () => {
  function capturingModel({ fail } = {}) {
    const seen = [];
    class ScriptedModel extends BaseChatModel {
      _llmType() {
        return 'scripted';
      }
      bindTools() {
        return this;
      }
      async _generate(messages) {
        seen.push(messages);
        if (fail) throw new Error(fail);
        return { generations: [{ text: 'a cat', message: new AIMessage('a cat') }] };
      }
      async *_streamResponseChunks(messages) {
        seen.push(messages);
        if (fail) throw new Error(fail);
        yield new ChatGenerationChunk({ text: 'a cat', message: new AIMessageChunk({ content: 'a cat' }) });
      }
    }
    return { model: new ScriptedModel({}), seen };
  }

  test('model receives the real image; the checkpoint keeps only the reference', async () => {
    const { model, seen } = capturingModel();
    const loadImage = jest.fn(async () => ({ data: b64(PNG), mimeType: 'image/png' }));
    const agent = createAgent({
      model,
      tools: [],
      checkpointer: new MemorySaver(),
      middleware: [createImageContentMiddleware({ loadImage, detectProvider: () => 'openai' })],
    });
    const config = { configurable: { thread_id: 'img-1' } };
    const content = buildHumanContent('what is this?', [
      { fileId: 'f1', mimeType: 'image/png', name: 'cat.png' },
    ]);
    await agent.invoke({ messages: [new HumanMessage({ content })] }, config);

    const sentHuman = seen[0].find((m) => m.getType() === 'human');
    expect(sentHuman.content).toEqual([
      { type: 'text', text: 'what is this?' },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${b64(PNG)}` } },
    ]);
    expect(loadImage).toHaveBeenCalledWith('f1');

    const state = await agent.getState(config);
    const stored = state.values.messages.find((m) => m.getType() === 'human');
    expect(stored.content[1]).toEqual({
      type: 'image',
      mimeType: 'image/png',
      personaFileId: 'f1',
      name: 'cat.png',
    });
  });

  test('a "no vision" provider error becomes MODEL_NO_VISION', async () => {
    const { model } = capturingModel({ fail: '400 This model does not support image input' });
    const agent = createAgent({
      model,
      tools: [],
      middleware: [
        createImageContentMiddleware({
          loadImage: async () => ({ data: 'AA', mimeType: 'image/png' }),
          detectProvider: () => 'openai',
        }),
      ],
    });
    const content = buildHumanContent('hi', [{ fileId: 'f1', mimeType: 'image/png' }]);
    let caught;
    try {
      await agent.invoke({ messages: [new HumanMessage({ content })] });
    } catch (err) {
      caught = err;
    }
    expect(classifyRuntimeError(caught).code).toBe('MODEL_NO_VISION');
    expect(caught.message).toMatch(/can't read images/);
  });
});

// ── base64 never leaks as text ──────────────────────────────────────────────
describe('binary blocks are never stringified', () => {
  const imageBlock = { type: 'image', mimeType: 'image/png', data: 'SECRETBASE64' };

  test('tool result streamed to the client', () => {
    const text = extractToolOutputContent(new ToolMessage({ tool_call_id: 't', content: [imageBlock] }));
    expect(text).toBe('[image content omitted (image/png)]');
  });

  test('OpenAI tool-message sanitization', () => {
    const { message } = sanitizeMessageForModel(
      new ToolMessage({ tool_call_id: 't', content: [{ type: 'text', text: 'ok' }, imageBlock] }),
      'openai'
    );
    expect(message.content).toBe('ok\n[image content omitted (image/png)]');
  });
});

// ── /uploads/ backend ───────────────────────────────────────────────────────
describe('attachments backend (/uploads/)', () => {
  const rec = (id, threadKey, name = `${id}.png`) => ({
    _id: id,
    originalName: name,
    mimeType: 'image/png',
    size: PNG.length,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    threadKey,
  });
  const files = {
    all: [rec('a1', 't1', 'my photo.png'), rec('b1', 't2')],
    async listThreadAttachments(key) {
      return this.all.filter((f) => f.threadKey === key);
    },
    async readFileBytes() {
      return PNG;
    },
  };

  test('lists and reads only the current thread’s images, as binary', async () => {
    const backend = createAttachmentsBackend({ files, getThreadKey: () => 't1' });
    const { files: listed } = await backend.ls('/');
    expect(listed.map((f) => f.path)).toEqual(['/a1-my_photo.png']);
    expect(attachmentKey(files.all[0])).toBe('/a1-my_photo.png');

    const read = await backend.read('/a1-my_photo.png');
    expect(read.mimeType).toBe('image/png');
    expect(read.content).toBeInstanceOf(Uint8Array);

    expect((await backend.read('/b1-b1.png')).error).toMatch(/not found/);
    expect((await backend.glob('*.png')).files).toHaveLength(1);
    expect((await backend.grep('x')).matches).toEqual([]);
  });

  test('deepagents read_file on /uploads/ hands the model the picture (real createDeepAgent)', async () => {
    const seen = [];
    const script = [
      { call: { id: 'call_1', name: 'read_file', args: { file_path: '/uploads/a1-my_photo.png' } } },
      { text: 'It is a photo.' },
    ];
    let turn = 0;
    class ScriptedModel extends BaseChatModel {
      _llmType() {
        return 'scripted';
      }
      bindTools() {
        return this;
      }
      async _generate(messages) {
        seen.push(messages);
        const step = script[turn++] ?? { text: '(done)' };
        const message = step.call
          ? new AIMessage({ content: '', tool_calls: [{ ...step.call, type: 'tool_call' }] })
          : new AIMessage(step.text);
        return { generations: [{ text: step.text ?? '', message }] };
      }
    }
    const { createDeepAgent, CompositeBackend, StateBackend } = await import('deepagents');
    const { readonlyBackend } = await import('../src/utils/readonlyBackend.js');
    const agent = await createDeepAgent({
      model: new ScriptedModel({}),
      checkpointer: new MemorySaver(),
      backend: new CompositeBackend(new StateBackend(), {
        // No getThreadKey: resolved from the run's configurable.thread_id.
        '/uploads/': readonlyBackend(createAttachmentsBackend({ files }), '/uploads/'),
      }),
      middleware: [
        createImageContentMiddleware({ loadImage: async () => null, detectProvider: () => 'openai' }),
      ],
    });
    await agent.invoke(
      { messages: [new HumanMessage('look at my photo')] },
      { configurable: { thread_id: 't1' } }
    );

    const second = seen[1];
    const tool = second.find((m) => m.getType() === 'tool');
    expect(tool.content).toEqual([
      { type: 'text', text: '[image: image/png — shown in the next message]' },
    ]);
    const followUp = second[second.indexOf(tool) + 1];
    expect(followUp.getType()).toBe('human');
    expect(followUp.content[1]).toEqual({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${b64(PNG)}` },
    });
  });

  test('no thread → empty folder', async () => {
    const backend = createAttachmentsBackend({ files, getThreadKey: () => undefined });
    expect((await backend.ls('/')).files).toEqual([]);
  });
});
