import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/agui/agui.service.js', () => ({
  runAgentAsAguiEvents: jest.fn(),
}));

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: { findById: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/externalUsers/externalUser.service.js', () => ({
  default: { resolveOrCreate: jest.fn() },
}));

jest.unstable_mockModule('../src/modules/projects/projectCredential.repository.js', () => ({
  default: { findByProject: jest.fn() },
}));

// Keeps this suite from pulling in the Gemini SDK / tool resolver chain.
// The extra exports satisfy twilioGateway.js's static imports.
jest.unstable_mockModule('../src/modules/voice/voice.service.js', () => ({
  assertNoGuardedTools: jest.fn(),
  resolveVoiceProvider: jest.fn(),
  buildVoiceLiveConfig: jest.fn(),
}));

jest.unstable_mockModule('../src/modules/auth/auth.middleware.js', () => ({
  default: (req, res, next) => {
    req.user = { _id: 'user_1' };
    next();
  },
}));

jest.unstable_mockModule('../src/modules/projects/projectMembership.repository.js', () => ({
  default: { findByProjectAndUser: jest.fn() },
}));

const { runAgentAsAguiEvents } = await import('../src/modules/agui/agui.service.js');
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const externalUserService = (await import('../src/modules/externalUsers/externalUser.service.js'))
  .default;
const projectCredentialRepository = (
  await import('../src/modules/projects/projectCredential.repository.js')
).default;
const { assertNoGuardedTools } = await import('../src/modules/voice/voice.service.js');
const projectMembershipRepository = (
  await import('../src/modules/projects/projectMembership.repository.js')
).default;
const twilioService = (await import('../src/modules/twilio/twilio.service.js')).default;
const twilioMessagingService = (await import('../src/modules/twilio/twilioMessaging.service.js'))
  .default;
const { default: twilioWebhookRouter } = await import('../src/modules/twilio/twilio.routes.js');
const twilioMessagingRouter = (await import('../src/modules/twilio/twilioMessaging.routes.js'))
  .default;
const errorHandler = (await import('../src/middlewares/errorHandler.js')).default;

function fakeClient() {
  const created = [];
  return {
    created,
    client: {
      messages: {
        create: jest.fn(async (payload) => {
          created.push(payload);
          return { sid: `SM_OUT_${created.length}`, status: 'queued' };
        }),
      },
    },
  };
}

function mockProjectConfig(overrides = {}) {
  const fake = fakeClient();
  jest.spyOn(twilioService, 'getClientForProject').mockResolvedValue({
    client: fake.client,
    phoneNumber: '+15550001111',
    smsNumber: null,
    whatsappNumber: '+14155238886',
    publicUrl: 'https://api.example.com',
    messagingServiceSid: null,
    ...overrides,
  });
  return fake;
}

function setAgentEvents(events) {
  runAgentAsAguiEvents.mockImplementation(async function* () {
    for (const event of events) yield event;
  });
}

describe('TwilioService messaging helpers', () => {
  test('detects and normalizes channel addresses', () => {
    expect(twilioService.detectChannel('whatsapp:+1415')).toBe('whatsapp');
    expect(twilioService.detectChannel('+1415')).toBe('sms');
    expect(twilioService.normalizePhoneNumber('whatsapp:+1415')).toBe('+1415');
    expect(twilioService.normalizePhoneNumber('sms:+1415')).toBe('+1415');
  });

  test('formats addresses with the channel prefix', () => {
    expect(twilioService.formatAddress('+1415', 'whatsapp')).toBe('whatsapp:+1415');
    expect(twilioService.formatAddress('whatsapp:+1415', 'sms')).toBe('+1415');
  });

  test('strips markdown for plain-text channels', () => {
    const source = '# Title\n**bold** and [link](https://x.dev)\n- one\n- two\n```js\ncode\n```';
    const out = twilioService.stripMarkdown(source);
    expect(out).toContain('Title');
    expect(out).toContain('bold');
    expect(out).toContain('link (https://x.dev)');
    expect(out).toContain('• one');
    expect(out).not.toContain('**');
    expect(out).not.toContain('```');
  });

  test('chunks SMS long bodies under the limit and keeps every character', () => {
    const body = 'x'.repeat(3200);
    const chunks = twilioService.chunkMessage(body, 'sms');
    expect(chunks).toHaveLength(3);
    expect(chunks.every((chunk) => chunk.length <= 1500)).toBe(true);
    expect(chunks.join('')).toBe(body);
  });

  test('prefers paragraph boundaries when chunking', () => {
    const first = 'a'.repeat(1200);
    const second = 'b'.repeat(1200);
    const chunks = twilioService.chunkMessage(`${first}\n\n${second}`, 'sms');
    expect(chunks[0]).toBe(first);
    expect(chunks[1]).toBe(second);
  });
});

describe('TwilioService.sendMessage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sends a WhatsApp message with the whatsapp sender and strips markdown', async () => {
    const fake = mockProjectConfig();

    const result = await twilioService.sendMessage({
      projectId: 'proj-1',
      to: 'whatsapp:+919876543210',
      body: '**Hello** there',
    });

    expect(fake.client.messages.create).toHaveBeenCalledTimes(1);
    expect(fake.created[0]).toMatchObject({
      to: 'whatsapp:+919876543210',
      from: 'whatsapp:+14155238886',
      body: 'Hello there',
    });
    expect(fake.created[0].statusCallback).toContain(
      '/api/v1/webhooks/twilio/message-status?projectId=proj-1'
    );
    expect(result).toMatchObject({
      channel: 'whatsapp',
      to: '+919876543210',
      parts: 1,
    });
  });

  test('uses the Messaging Service SID for SMS instead of a from number', async () => {
    const fake = mockProjectConfig({ messagingServiceSid: 'MG123' });

    await twilioService.sendMessage({ projectId: 'proj-1', to: '+919876543210', body: 'hi' });

    expect(fake.created[0].messagingServiceSid).toBe('MG123');
    expect(fake.created[0].from).toBeUndefined();
  });

  test('splits long bodies and attaches media only to the first part', async () => {
    const fake = mockProjectConfig();

    const result = await twilioService.sendMessage({
      projectId: 'proj-1',
      to: '+919876543210',
      body: 'x'.repeat(3200),
      mediaUrl: 'https://cdn.example.com/a.png',
    });

    expect(result.parts).toBe(3);
    expect(fake.created).toHaveLength(3);
    expect(fake.created[0].mediaUrl).toEqual(['https://cdn.example.com/a.png']);
    expect(fake.created[1].mediaUrl).toBeUndefined();
  });

  test('contentSid takes precedence over body', async () => {
    const fake = mockProjectConfig();

    await twilioService.sendMessage({
      projectId: 'proj-1',
      to: 'whatsapp:+919876543210',
      body: 'ignored',
      contentSid: 'HX123',
      contentVariables: { 1: 'Rai' },
    });

    expect(fake.client.messages.create).toHaveBeenCalledTimes(1);
    expect(fake.created[0]).toMatchObject({
      contentSid: 'HX123',
      contentVariables: JSON.stringify({ 1: 'Rai' }),
    });
    expect(fake.created[0].body).toBeUndefined();
  });

  test('rejects empty bodies without a template', async () => {
    mockProjectConfig();

    await expect(
      twilioService.sendMessage({ projectId: 'proj-1', to: '+919876543210', body: '   ' })
    ).rejects.toMatchObject({ code: 'MESSAGE_BODY_REQUIRED', statusCode: 400 });
  });

  test('refuses to send to the project sender number itself', async () => {
    mockProjectConfig();

    await expect(
      twilioService.sendMessage({ projectId: 'proj-1', to: '+15550001111', body: 'loop' })
    ).rejects.toMatchObject({ code: 'MESSAGE_LOOP_DETECTED', statusCode: 400 });
  });

  test('rejects WhatsApp when no WhatsApp sender is configured', async () => {
    mockProjectConfig({ whatsappNumber: null });

    await expect(
      twilioService.sendMessage({
        projectId: 'proj-1',
        to: 'whatsapp:+919876543210',
        body: 'hi',
      })
    ).rejects.toMatchObject({ code: 'TWILIO_WHATSAPP_NUMBER_REQUIRED', statusCode: 422 });
  });
});

describe('TwilioMessagingService inbound pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    twilioMessagingService.resetForTests();
    agentRepository.findById.mockResolvedValue({
      _id: 'agent-1',
      domain: 'proj-1',
      isActive: true,
      interruptOn: {},
    });
    projectCredentialRepository.findByProject.mockResolvedValue([
      { _id: 'cred-1', status: 'ACTIVE' },
    ]);
    externalUserService.resolveOrCreate.mockResolvedValue({});
    assertNoGuardedTools.mockImplementation(() => {});
    jest.spyOn(twilioService, 'sendMessage').mockResolvedValue({
      channel: 'whatsapp',
      messageSids: ['SM_OUT_1'],
      parts: 1,
    });
    setAgentEvents([
      { type: 'TEXT_MESSAGE_CHUNK', delta: 'Hello ' },
      { type: 'TEXT_MESSAGE_CHUNK', delta: 'there' },
      { type: 'RUN_FINISHED' },
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const inbound = (overrides = {}) => ({
    projectId: 'proj-1',
    agentId: 'agent-1',
    from: 'whatsapp:+919876543210',
    to: 'whatsapp:+14155238886',
    body: 'Hi there',
    messageSid: 'SM_IN_1',
    profileName: 'Rai',
    ...overrides,
  });

  test('runs the agent on the phone-shared thread and replies over the same channel', async () => {
    const result = await twilioMessagingService.handleInboundMessage(inbound());

    expect(result.handled).toBe(true);
    expect(externalUserService.resolveOrCreate).toHaveBeenCalledWith('proj-1', '+919876543210', {
      displayName: 'Rai',
    });
    expect(runAgentAsAguiEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agent-1',
        userId: '+919876543210',
        langGraphThreadId: 'agui-proj-1-agent-1-+919876543210',
        allowPrivateExecution: true,
        executionContext: expect.objectContaining({
          domain: 'proj-1',
          principalType: 'ProjectRuntime',
          credentialId: 'cred-1',
          externalUserId: '+919876543210',
        }),
      })
    );
    expect(twilioService.sendMessage).toHaveBeenCalledWith({
      projectId: 'proj-1',
      to: '+919876543210',
      channel: 'whatsapp',
      body: 'Hello there',
    });
  });

  test('falls back to the twilio credential marker when the project has no active credential', async () => {
    projectCredentialRepository.findByProject.mockResolvedValue([]);

    await twilioMessagingService.handleInboundMessage(inbound());

    expect(runAgentAsAguiEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        executionContext: expect.objectContaining({ credentialId: 'twilio' }),
      })
    );
  });

  test('refuses an agent whose tools require HITL approval', async () => {
    assertNoGuardedTools.mockImplementation(() => {
      const err = new Error('guarded');
      err.code = 'VOICE_INTERRUPT_ON_UNSUPPORTED';
      throw err;
    });

    const result = await twilioMessagingService.handleInboundMessage(inbound());

    expect(result).toMatchObject({ handled: false, reason: 'guarded_tools' });
    expect(runAgentAsAguiEvents).not.toHaveBeenCalled();
    expect(twilioService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('not available on this channel') })
    );
  });

  test('refuses an agent owned by another Project', async () => {
    agentRepository.findById.mockResolvedValue({ _id: 'agent-1', domain: 'other', isActive: true });

    const result = await twilioMessagingService.handleInboundMessage(inbound());

    expect(result).toMatchObject({ handled: false, reason: 'agent_unavailable' });
    expect(runAgentAsAguiEvents).not.toHaveBeenCalled();
  });

  test('refuses a soft-deleted or inactive agent', async () => {
    agentRepository.findById.mockResolvedValue({
      _id: 'agent-1',
      domain: 'proj-1',
      isActive: false,
      deletedAt: null,
    });

    const result = await twilioMessagingService.handleInboundMessage(inbound());

    expect(result).toMatchObject({ handled: false, reason: 'agent_unavailable' });
  });

  test('refuses the virtual Architect agents without a lookup', async () => {
    const result = await twilioMessagingService.handleInboundMessage(
      inbound({ agentId: '000000000000000000000000' })
    );

    expect(result).toMatchObject({ handled: false, reason: 'agent_unavailable' });
    expect(agentRepository.findById).not.toHaveBeenCalled();
  });

  test('reports a generic error when the run fails', async () => {
    setAgentEvents([{ type: 'RUN_ERROR', code: 'PROVIDER_ERROR', message: 'upstream 500' }]);

    const result = await twilioMessagingService.handleInboundMessage(inbound());

    expect(result.handled).toBe(true);
    expect(result.runError).toMatchObject({ code: 'PROVIDER_ERROR' });
    expect(twilioService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('something went wrong') })
    );
  });

  test('answers media-only messages with a text-only notice', async () => {
    const result = await twilioMessagingService.handleInboundMessage(
      inbound({ body: '', mediaUrls: ['https://cdn.example.com/a.png'] })
    );

    expect(result).toMatchObject({ handled: false, reason: 'empty_body' });
    expect(twilioService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('only read text') })
    );
  });

  test('serializes turns for the same conversation', async () => {
    const order = [];
    runAgentAsAguiEvents.mockImplementation(async function* () {
      order.push('start');
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push('end');
      yield { type: 'TEXT_MESSAGE_CHUNK', delta: 'ok' };
    });

    const one = twilioMessagingService.handleInboundMessage(inbound({ messageSid: 'SM_A' }));
    const two = twilioMessagingService.handleInboundMessage(inbound({ messageSid: 'SM_B' }));
    await Promise.all([one, two]);

    expect(order).toEqual(['start', 'end', 'start', 'end']);
  });

  test('dedupes retried MessageSids', () => {
    expect(twilioMessagingService.registerInboundMessage('SM_SAME')).toBe(false);
    expect(twilioMessagingService.registerInboundMessage('SM_SAME')).toBe(true);
    expect(twilioMessagingService.registerInboundMessage()).toBe(false);
  });
});

describe('TwilioMessagingService.sendAgentMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    twilioMessagingService.resetForTests();
    agentRepository.findById.mockResolvedValue({
      _id: 'agent-1',
      domain: 'proj-1',
      isActive: true,
      interruptOn: {},
    });
    projectCredentialRepository.findByProject.mockResolvedValue([]);
    externalUserService.resolveOrCreate.mockResolvedValue({});
    assertNoGuardedTools.mockImplementation(() => {});
    setAgentEvents([{ type: 'TEXT_MESSAGE_CHUNK', delta: 'Composed reply' }]);
    jest.spyOn(twilioService, 'sendMessage').mockResolvedValue({
      channel: 'sms',
      messageSids: ['SM_OUT_1'],
      parts: 1,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('runs the agent and delivers the composed reply', async () => {
    const result = await twilioMessagingService.sendAgentMessage({
      projectId: 'proj-1',
      agentId: 'agent-1',
      to: '+919876543210',
      prompt: 'Follow up with the user',
    });

    expect(result).toMatchObject({ agentId: 'agent-1', channel: 'sms' });
    expect(twilioService.sendMessage).toHaveBeenCalledWith({
      projectId: 'proj-1',
      to: '+919876543210',
      channel: 'sms',
      body: 'Composed reply',
    });
  });

  test('returns 404 for an unknown agent', async () => {
    agentRepository.findById.mockResolvedValue(null);

    await expect(
      twilioMessagingService.sendAgentMessage({
        projectId: 'proj-1',
        agentId: 'missing',
        to: '+919876543210',
        prompt: 'hello',
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  test('requires a prompt', async () => {
    await expect(
      twilioMessagingService.sendAgentMessage({
        projectId: 'proj-1',
        agentId: 'agent-1',
        to: '+919876543210',
        prompt: '  ',
      })
    ).rejects.toMatchObject({ code: 'MESSAGE_PROMPT_REQUIRED', statusCode: 400 });
  });

  test('surfaces an empty reply as a 502', async () => {
    setAgentEvents([{ type: 'RUN_FINISHED' }]);

    await expect(
      twilioMessagingService.sendAgentMessage({
        projectId: 'proj-1',
        agentId: 'agent-1',
        to: '+919876543210',
        prompt: 'hello',
      })
    ).rejects.toMatchObject({ code: 'AGENT_EMPTY_REPLY', statusCode: 502 });
  });
});

describe('Twilio messaging webhook routes', () => {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use('/api/v1/webhooks/twilio', twilioWebhookRouter);
  app.use(errorHandler);

  beforeEach(() => {
    jest.clearAllMocks();
    twilioMessagingService.resetForTests();
    jest.spyOn(twilioService, 'validateRequest').mockResolvedValue(true);
    jest.spyOn(twilioMessagingService, 'handleInboundMessage').mockResolvedValue({ handled: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('acknowledges a valid inbound message and starts the pipeline', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/twilio/message?projectId=proj-1&agentId=agent-1')
      .type('form')
      .send({ From: 'whatsapp:+919876543210', Body: 'hello', MessageSid: 'SM_1' });

    expect(res.status).toBe(200);
    expect(twilioMessagingService.handleInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        agentId: 'agent-1',
        from: 'whatsapp:+919876543210',
        body: 'hello',
        messageSid: 'SM_1',
      })
    );
  });

  test('rejects an invalid Twilio signature', async () => {
    twilioService.validateRequest.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/v1/webhooks/twilio/message?projectId=proj-1&agentId=agent-1')
      .type('form')
      .send({ From: '+919876543210', Body: 'hello', MessageSid: 'SM_2' });

    expect(res.status).toBe(403);
    expect(twilioMessagingService.handleInboundMessage).not.toHaveBeenCalled();
  });

  test('does not run a retried MessageSid twice', async () => {
    const payload = { From: '+919876543210', Body: 'hello', MessageSid: 'SM_3' };

    await request(app)
      .post('/api/v1/webhooks/twilio/message?projectId=proj-1&agentId=agent-1')
      .type('form')
      .send(payload);
    const second = await request(app)
      .post('/api/v1/webhooks/twilio/message?projectId=proj-1&agentId=agent-1')
      .type('form')
      .send(payload);

    expect(second.status).toBe(200);
    expect(twilioMessagingService.handleInboundMessage).toHaveBeenCalledTimes(1);
  });

  test('acknowledges a webhook URL missing its routing parameters', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/twilio/message')
      .type('form')
      .send({ From: '+919876543210', Body: 'hello', MessageSid: 'SM_4' });

    expect(res.status).toBe(200);
    expect(twilioMessagingService.handleInboundMessage).not.toHaveBeenCalled();
  });

  test('acknowledges delivery status callbacks with 204', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/twilio/message-status')
      .type('form')
      .send({ MessageSid: 'SM_5', MessageStatus: 'delivered' });

    expect(res.status).toBe(204);
  });
});

describe('Project Twilio messaging routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/projects/:projectId/twilio', twilioMessagingRouter);
  app.use(errorHandler);

  beforeEach(() => {
    jest.clearAllMocks();
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({ role: 'Admin' });
    jest.spyOn(twilioService, 'sendMessage').mockResolvedValue({
      channel: 'sms',
      messageSids: ['SM_OUT_1'],
      parts: 1,
    });
    jest.spyOn(twilioMessagingService, 'sendAgentMessage').mockResolvedValue({
      agentId: 'agent-1',
      channel: 'sms',
      messageSids: ['SM_OUT_2'],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sends a plain message for a Project Admin', async () => {
    const res = await request(app)
      .post('/api/v1/projects/proj-1/twilio/messages')
      .send({ to: '+919876543210', body: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ channel: 'sms' });
    expect(twilioService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-1', to: '+919876543210', body: 'hello' })
    );
  });

  test('returns 400 when the recipient is missing', async () => {
    // Let the real validation run instead of the happy-path stub.
    twilioService.sendMessage.mockRestore();

    const res = await request(app)
      .post('/api/v1/projects/proj-1/twilio/messages')
      .send({ body: 'hello' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PHONE_NUMBER_REQUIRED');
  });

  test('rejects a caller who is not a Project Admin', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/projects/proj-1/twilio/messages')
      .send({ to: '+919876543210', body: 'hello' });

    expect(res.status).toBe(404);
    expect(twilioService.sendMessage).not.toHaveBeenCalled();
  });

  test('composes a message through an Agent', async () => {
    const res = await request(app)
      .post('/api/v1/projects/proj-1/twilio/messages/agent')
      .send({ agentId: 'agent-1', to: '+919876543210', prompt: 'Follow up' });

    expect(res.status).toBe(200);
    expect(twilioMessagingService.sendAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        agentId: 'agent-1',
        to: '+919876543210',
        prompt: 'Follow up',
      })
    );
  });
});
