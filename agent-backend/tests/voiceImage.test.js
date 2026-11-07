import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

const sentRealtimeInputs = [];
const mockGeminiSession = {
  sendRealtimeInput: jest.fn((input) => sentRealtimeInputs.push(input)),
  sendToolResponse: jest.fn(),
  close: jest.fn(),
};

jest.unstable_mockModule('../src/modules/voice/gateway/geminiLiveClient.js', () => {
  const connectGeminiLive = jest.fn(async ({ callbacks }) => {
    callbacks.onopen?.();
    return mockGeminiSession;
  });
  return { connectGeminiLive, default: { connectGeminiLive } };
});

const { VoiceSession } = await import('../src/modules/voice/gateway/VoiceSession.js');
const { resolveVoiceImage, VoiceImageError, UNCAPTIONED_IMAGE_PROMPT } = await import(
  '../src/modules/voice/voiceImage.js'
);
const { voiceTurnToMessage } = await import('../src/modules/voice/voiceThread.service.js');

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 1),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 2)]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(16, 3)]);
const SUBJECT = { domain: 'proj_1', externalUserId: 'user_1' };

class MockClientWebSocket extends EventEmitter {
  constructor() {
    super();
    this.OPEN = 1;
    this.readyState = 1;
    this.sent = [];
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  ping() {}
  close() {
    this.readyState = 3;
    this.emit('close');
  }
}

function fakeFiles() {
  return {
    created: [],
    async createAttachmentFromBuffer(subject, { buffer, mimeType, name }) {
      const file = { _id: `file_${this.created.length + 1}`, originalName: name || 'image.jpg', size: buffer.length, mimeType };
      this.created.push({ subject, file });
      return file;
    },
    async getOwnedFile(id, subject) {
      return id === 'owned' && subject ? { _id: 'owned', originalName: 'p.png', size: PNG.length } : null;
    },
    async readFileBytes() {
      return PNG;
    },
  };
}

describe('resolveVoiceImage', () => {
  test('accepts inline JPEG (data URL too) and stores it only when persisting', async () => {
    const files = fakeFiles();
    const ephemeral = await resolveVoiceImage(
      { data: `data:image/jpeg;base64,${JPEG.toString('base64')}` },
      { subject: SUBJECT, files }
    );
    expect(ephemeral.mimeType).toBe('image/jpeg');
    expect(ephemeral.ref).toBeNull();
    expect(files.created).toHaveLength(0);

    const stored = await resolveVoiceImage(
      { data: JPEG.toString('base64'), name: 'shot.jpg' },
      { subject: SUBJECT, files, persist: true, agentId: 'a1' }
    );
    expect(stored.ref).toEqual({ fileId: 'file_1', mimeType: 'image/jpeg', name: 'shot.jpg', size: JPEG.length });
  });

  test('reads an owned uploaded file by id', async () => {
    const out = await resolveVoiceImage({ fileId: 'owned' }, { subject: SUBJECT, files: fakeFiles() });
    expect(out.mimeType).toBe('image/png');
    expect(out.ref.fileId).toBe('owned');
  });

  test('rejects GIF, garbage, missing payload and foreign files', async () => {
    const files = fakeFiles();
    await expect(resolveVoiceImage({ data: GIF.toString('base64') }, { files })).rejects.toThrow(/JPEG|jpeg/);
    await expect(resolveVoiceImage({ data: Buffer.alloc(20).toString('base64') }, { files })).rejects.toBeInstanceOf(VoiceImageError);
    await expect(resolveVoiceImage({}, { files })).rejects.toThrow(/data/);
    await expect(resolveVoiceImage({ fileId: 'other' }, { subject: SUBJECT, files })).rejects.toThrow(/not found/);
  });
});

describe('VoiceSession voice.image', () => {
  let clientWs;
  let session;
  let commits;
  let binds;

  async function start(imageInput) {
    session = new VoiceSession({
      clientWs,
      claims: { principalType: 'ProjectRuntime', domain: 'proj_1', agentId: 'a1', subjectId: 'user_1', threadId: 'thread_1' },
      apiKey: 'k',
      model: 'm',
      voiceName: 'Puck',
      liveConfig: {},
      toolsByName: new Map(),
      onTranscriptCommit: (role, text, attachments) => commits.push({ role, text, attachments }),
      imageInput: {
        subject: SUBJECT,
        agentId: 'a1',
        bindToThread: async (ids, key) => binds.push({ ids, key }),
        ...imageInput,
      },
    });
    await session.start();
  }

  const imageEvents = () => clientWs.sent.filter((e) => e.name === 'voice_image').map((e) => e.value);
  const flush = () => new Promise((r) => setImmediate(r));
  const sendImage = async (msg) => {
    clientWs.emit('message', Buffer.from(JSON.stringify({ type: 'voice.image', ...msg })), false);
    await flush();
    await flush();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sentRealtimeInputs.length = 0;
    clientWs = new MockClientWebSocket();
    commits = [];
    binds = [];
  });

  afterEach(() => {
    if (session && !session.closed) session._closeSession('test_teardown');
  });

  test('rejects when the agent has image input off', async () => {
    await start({ enabled: false });
    await sendImage({ id: 'i1', data: JPEG.toString('base64') });
    expect(imageEvents()).toEqual([
      expect.objectContaining({ id: 'i1', status: 'rejected', code: 'IMAGE_INPUT_DISABLED' }),
    ]);
    expect(sentRealtimeInputs).toHaveLength(0);
  });

  test('forwards the image as a video frame, then the caption, and persists the turn', async () => {
    const files = fakeFiles();
    await start({
      enabled: true,
      persist: true,
      resolveImage: (msg, opts) => resolveVoiceImage(msg, { ...opts, files }),
    });
    await sendImage({ id: 'i1', data: JPEG.toString('base64'), text: ' What is this? ' });

    expect(sentRealtimeInputs).toEqual([
      { video: { data: JPEG.toString('base64'), mimeType: 'image/jpeg' } },
      { text: 'What is this?' },
    ]);
    expect(imageEvents()[0]).toEqual({
      id: 'i1',
      status: 'accepted',
      attachment: { fileId: 'file_1', mimeType: 'image/jpeg', name: 'image.jpg' },
    });
    const transcript = clientWs.sent.find((e) => e.name === 'voice_transcript');
    expect(transcript.value).toMatchObject({ speaker: 'user', text: 'What is this?', attachments: [{ fileId: 'file_1' }] });
    expect(commits).toEqual([
      { role: 'user', text: 'What is this?', attachments: [expect.objectContaining({ fileId: 'file_1' })] },
    ]);
    expect(binds).toEqual([{ ids: ['file_1'], key: 'thread_1' }]);
  });

  test('uncaptioned image gets a prompt so the model answers; ephemeral calls store nothing', async () => {
    const files = fakeFiles();
    await start({ enabled: true, persist: false, resolveImage: (msg, opts) => resolveVoiceImage(msg, { ...opts, files }) });
    await sendImage({ id: 'i1', data: PNG.toString('base64') });
    expect(sentRealtimeInputs[1]).toEqual({ text: UNCAPTIONED_IMAGE_PROMPT });
    expect(files.created).toHaveLength(0);
    expect(commits).toHaveLength(0);
    expect(binds).toHaveLength(0);
    expect(imageEvents()[0]).toMatchObject({ status: 'accepted', attachment: { mimeType: 'image/png' } });
  });

  test('rate limits to one image per second and reports bad images', async () => {
    await start({ enabled: true });
    await sendImage({ id: 'a', data: JPEG.toString('base64') });
    await sendImage({ id: 'b', data: JPEG.toString('base64') });
    expect(imageEvents().map((e) => [e.id, e.status, e.code])).toEqual([
      ['a', 'accepted', undefined],
      ['b', 'rejected', 'RATE_LIMITED'],
    ]);

    session.lastImageAt = 0;
    await sendImage({ id: 'c', data: GIF.toString('base64') });
    expect(imageEvents()[2]).toMatchObject({ id: 'c', status: 'rejected', code: 'INVALID_ATTACHMENT' });
  });
});

describe('voiceTurnToMessage with images', () => {
  test('stores image references like chat, and allows an image-only user turn', () => {
    const msg = voiceTurnToMessage('user', '', [{ fileId: 'f1', mimeType: 'image/jpeg', name: 'x.jpg' }]);
    expect(msg.content).toEqual([{ type: 'image', mimeType: 'image/jpeg', personaFileId: 'f1', name: 'x.jpg' }]);
    expect(voiceTurnToMessage('user', 'hi').content).toBe('hi');
    expect(voiceTurnToMessage('user', '', [])).toBeNull();
  });
});
