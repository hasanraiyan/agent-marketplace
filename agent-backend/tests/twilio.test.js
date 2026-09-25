import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { EventEmitter } from 'events';
import { twilioWebhookRouter, outboundCallRouter } from '../src/modules/twilio/index.js';
import twilioService from '../src/modules/twilio/twilio.service.js';
import TwilioVoiceTransport from '../src/modules/twilio/TwilioVoiceTransport.js';
import errorHandler from '../src/middlewares/errorHandler.js';

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/api/v1/webhooks/twilio', twilioWebhookRouter);
app.use('/api/v1/twilio', outboundCallRouter);
app.use(errorHandler);

describe('Twilio Webhooks and Voice Bridge', () => {
  describe('POST /api/v1/webhooks/twilio/voice', () => {
    test('returns unavailable TwiML when projectId or agentId is missing', async () => {
      const res = await request(app).post('/api/v1/webhooks/twilio/voice').send();

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/xml');
      expect(res.text).toContain('<Say>');
      expect(res.text).toContain('<Hangup/>');
    });

    test('returns valid TwiML with <Connect><Stream> when projectId and agentId are supplied', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/twilio/voice?projectId=proj-123&agentId=agent-456')
        .type('form')
        .send({ From: '+919876543210' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/xml');
      expect(res.text).toContain('<Connect>');
      expect(res.text).toContain('<Stream url=');
      expect(res.text).toContain('/api/v1/twilio/media-stream');
      expect(res.text).toContain('name="agentId" value="agent-456"');
      expect(res.text).toContain('name="projectId" value="proj-123"');
      expect(res.text).toContain('name="callerPhone" value="+919876543210"');
    });
  });

  describe('POST /api/v1/webhooks/twilio/status', () => {
    test('returns 204 on status update', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/twilio/status')
        .type('form')
        .send({ CallSid: 'CA12345', CallStatus: 'completed', CallDuration: '45' });

      expect(res.status).toBe(204);
    });
  });

  describe('POST /api/v1/twilio/call', () => {
    test('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/v1/twilio/call').send({ to: '+919876543210' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('TwilioVoiceTransport Adapter', () => {
    class MockWebSocket extends EventEmitter {
      constructor() {
        super();
        this.readyState = 1; // OPEN
        this.sent = [];
      }
      send(data) {
        this.sent.push(data);
      }
      close() {
        this.readyState = 3;
        this.emit('close');
      }
    }

    test('parses "start" event and emits "stream_started"', (done) => {
      const mockWs = new MockWebSocket();
      const transport = new TwilioVoiceTransport({ twilioWs: mockWs });

      transport.on('stream_started', ({ streamSid, callSid, customParameters }) => {
        expect(streamSid).toBe('MZ123');
        expect(callSid).toBe('CA456');
        expect(customParameters.agentId).toBe('agent-test');
        transport.close();
        done();
      });

      mockWs.emit(
        'message',
        JSON.stringify({
          event: 'start',
          start: {
            streamSid: 'MZ123',
            callSid: 'CA456',
            customParameters: { agentId: 'agent-test', projectId: 'proj-test' },
          },
        })
      );
    });

    test('decodes inbound mu-law media payload and emits binary PCM16 message', (done) => {
      const mockWs = new MockWebSocket();
      const transport = new TwilioVoiceTransport({ twilioWs: mockWs });

      // 160 bytes of silence in mu-law
      const mulawPayload = Buffer.alloc(160, 0xff).toString('base64');

      transport.on('message', (buffer, isBinary) => {
        expect(isBinary).toBe(true);
        expect(Buffer.isBuffer(buffer)).toBe(true);
        // 160 bytes mu-law -> 640 bytes 16kHz PCM16
        expect(buffer.length).toBe(640);
        transport.close();
        done();
      });

      mockWs.emit(
        'message',
        JSON.stringify({
          event: 'media',
          media: { payload: mulawPayload },
        })
      );
    });

    test('sends clear event to Twilio on voice_interrupted barge-in', () => {
      const mockWs = new MockWebSocket();
      const transport = new TwilioVoiceTransport({ twilioWs: mockWs, streamSid: 'MZ_INTERRUPT' });

      // Pass AG-UI voice_interrupted event
      transport.send(
        JSON.stringify({
          type: 'CUSTOM',
          name: 'voice_interrupted',
          value: { turnSeq: 5 },
        })
      );

      const clearMsg = mockWs.sent.find((s) => {
        try {
          const parsed = JSON.parse(s);
          return parsed.event === 'clear';
        } catch {
          return false;
        }
      });

      expect(clearMsg).toBeDefined();
      const parsed = JSON.parse(clearMsg);
      expect(parsed.streamSid).toBe('MZ_INTERRUPT');
      transport.close();
    });

    test('enforces MAX_OUTBOUND_QUEUE_CHUNKS queue watermarking on high outbound buffer', () => {
      const mockWs = new MockWebSocket();
      const transport = new TwilioVoiceTransport({ twilioWs: mockWs, streamSid: 'MZ_QUEUE' });

      // Generate a large 24kHz PCM16 buffer (turnSeq=1 + 10 seconds of 24kHz audio = 480,000 bytes)
      const bigAudioBuffer = Buffer.alloc(4 + 480000);
      bigAudioBuffer.writeUInt32LE(1, 0);

      transport.send(bigAudioBuffer);

      // Verify outboundMulawQueue is capped at 250 chunks (5 seconds max buffer)
      expect(transport.outboundMulawQueue.length).toBeLessThanOrEqual(250);
      expect(transport.outboundMulawQueue.length).toBeGreaterThan(0);
      transport.close();
    });
  });

  describe('Project Secret Multi-tenant Credential Resolution', () => {
    test('resolves twilio credentials from projectSecretService for a project', async () => {
      const mockProjectSecretService = (
        await import('../src/modules/projects/projectSecret.service.js')
      ).default;
      const originalResolve = mockProjectSecretService.resolveSecretByLabel;

      mockProjectSecretService.resolveSecretByLabel = jest.fn(async (domain, label) => {
        if (domain !== 'proj-xyz') return null;
        if (label === 'TWILIO_ACCOUNT_SID') return 'AC_PROJECT_SPECIFIC';
        if (label === 'TWILIO_AUTH_TOKEN') return 'AUTH_PROJECT_SPECIFIC';
        if (label === 'TWILIO_PHONE_NUMBER') return '+15550001111';
        if (label === 'TWILIO_PUBLIC_URL') return 'https://project-call.example.com';
        return null;
      });

      const creds = await twilioService.resolveProjectTwilioConfig('proj-xyz');
      expect(creds.accountSid).toBe('AC_PROJECT_SPECIFIC');
      expect(creds.authToken).toBe('AUTH_PROJECT_SPECIFIC');
      expect(creds.phoneNumber).toBe('+15550001111');
      expect(creds.publicUrl).toBe('https://project-call.example.com');

      mockProjectSecretService.resolveSecretByLabel = originalResolve;
    });

    test('returns 422 if project has no Twilio secrets configured when placing outbound call', async () => {
      const res = await request(app)
        .post('/api/v1/twilio/call')
        .send({ to: '+919876543210', projectId: 'proj-no-secrets', agentId: 'agent-123' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('TWILIO_ACCOUNT_SID');
    });
  });
});
