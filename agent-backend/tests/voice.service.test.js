import { jest } from '@jest/globals';

const mockProviderRepo = {
  findById: jest.fn(),
  findByDomain: jest.fn(),
};

const mockEncryption = {
  decrypt: jest.fn(),
};

const mockResolveAgentTools = jest.fn();

jest.unstable_mockModule('../src/modules/providers/provider.repository.js', () => ({
  default: mockProviderRepo,
}));

jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  default: mockEncryption,
}));

jest.unstable_mockModule('../src/modules/tools/index.js', () => ({
  resolveAgentTools: mockResolveAgentTools,
}));

const { resolveVoiceProvider, assertNoGuardedTools, resolveVoiceTools, buildVoiceLiveConfig } =
  await import('../src/modules/voice/voice.service.js');

describe('Voice Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('assertNoGuardedTools', () => {
    test('passes when agent has no interruptOn config', () => {
      expect(() => assertNoGuardedTools({})).not.toThrow();
      expect(() => assertNoGuardedTools({ interruptOn: {} })).not.toThrow();
      expect(() => assertNoGuardedTools({ interruptOn: new Map() })).not.toThrow();
      expect(() => assertNoGuardedTools({ interruptOn: { toolA: false } })).not.toThrow();
    });

    test('throws VOICE_INTERRUPT_ON_UNSUPPORTED when agent has a guarded tool (plain object)', () => {
      expect(() => assertNoGuardedTools({ interruptOn: { criticalAction: true } })).toThrow(
        expect.objectContaining({
          code: 'VOICE_INTERRUPT_ON_UNSUPPORTED',
          statusCode: 422,
        })
      );
    });

    test('throws VOICE_INTERRUPT_ON_UNSUPPORTED when agent has a guarded tool (Map)', () => {
      const map = new Map([['transfer_funds', true]]);
      expect(() => assertNoGuardedTools({ interruptOn: map })).toThrow(
        expect.objectContaining({
          code: 'VOICE_INTERRUPT_ON_UNSUPPORTED',
          statusCode: 422,
        })
      );
    });
  });

  describe('resolveVoiceProvider', () => {
    const domain = 'proj_alpha';

    test('resolves agent.providerId directly when provider is of type gemini', async () => {
      mockProviderRepo.findById.mockResolvedValue({
        _id: 'prov_direct',
        type: 'gemini',
        label: 'Agent Gemini Key',
        apiKeyEncrypted: 'enc:xyz',
      });
      mockEncryption.decrypt.mockReturnValue('sk-gemini-direct');

      const result = await resolveVoiceProvider({ providerId: 'prov_direct' }, domain);
      expect(result.id).toBe('prov_direct');
      expect(result.label).toBe('Agent Gemini Key');
      expect(result.apiKey).toBe('sk-gemini-direct');
    });

    test('falls back to default gemini provider in domain when agent has no providerId', async () => {
      mockProviderRepo.findByDomain.mockResolvedValue([
        { _id: 'p1', type: 'openai', isDefault: false },
        {
          _id: 'p2',
          type: 'gemini',
          isDefault: false,
          label: 'Secondary Gemini',
          apiKeyEncrypted: 'enc:2',
        },
        {
          _id: 'p3',
          type: 'gemini',
          isDefault: true,
          label: 'Default Gemini',
          apiKeyEncrypted: 'enc:3',
        },
      ]);
      mockEncryption.decrypt.mockReturnValue('sk-gemini-default');

      const result = await resolveVoiceProvider({}, domain);
      expect(result.id).toBe('p3');
      expect(result.label).toBe('Default Gemini');
      expect(result.apiKey).toBe('sk-gemini-default');
    });

    test('throws 422 if no gemini provider exists in domain', async () => {
      mockProviderRepo.findByDomain.mockResolvedValue([
        { _id: 'p1', type: 'openai', isDefault: true },
      ]);

      await expect(resolveVoiceProvider({}, domain)).rejects.toThrow(
        expect.objectContaining({
          code: 'VOICE_PROVIDER_REQUIRED',
          statusCode: 422,
        })
      );
    });

    test('throws 422 if gemini provider is missing apiKeyEncrypted', async () => {
      mockProviderRepo.findByDomain.mockResolvedValue([
        { _id: 'p1', type: 'gemini', label: 'Incomplete Gemini', isDefault: true },
      ]);

      await expect(resolveVoiceProvider({}, domain)).rejects.toThrow(
        expect.objectContaining({
          code: 'VOICE_PROVIDER_REQUIRED',
          statusCode: 422,
        })
      );
    });

    test('throws 422 if decryption fails', async () => {
      mockProviderRepo.findByDomain.mockResolvedValue([
        {
          _id: 'p1',
          type: 'gemini',
          label: 'Corrupted Key',
          isDefault: true,
          apiKeyEncrypted: 'enc:bad',
        },
      ]);
      mockEncryption.decrypt.mockImplementation(() => {
        throw new Error('Decryption error: invalid tag');
      });

      await expect(resolveVoiceProvider({}, domain)).rejects.toThrow(
        expect.objectContaining({
          code: 'VOICE_PROVIDER_REQUIRED',
          statusCode: 422,
        })
      );
    });
  });

  describe('resolveVoiceTools', () => {
    test('filters out excluded voice tools and sanitizes schemas for Gemini', async () => {
      const toolA = {
        name: 'search_weather',
        description: 'Checks current weather',
        schema: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location'],
        },
      };
      const excludedTool = {
        name: 'ask_clarification',
        description: 'Should be excluded from voice',
        schema: {},
      };

      mockResolveAgentTools.mockResolvedValue({
        tools: [toolA, excludedTool],
      });

      const { functionDeclarations, toolsByName } = await resolveVoiceTools(
        { _id: 'agent_1' },
        'proj_alpha',
        {}
      );

      expect(functionDeclarations.length).toBe(1);
      expect(functionDeclarations[0].name).toBe('search_weather');
      expect(toolsByName.has('search_weather')).toBe(true);
      expect(toolsByName.has('ask_clarification')).toBe(false);
    });
  });

  describe('buildVoiceLiveConfig', () => {
    test('builds full LiveConnectConfig with system preamble and end_call tool', async () => {
      mockResolveAgentTools.mockResolvedValue({ tools: [] });

      const agent = {
        _id: 'agent_99',
        systemPrompt: 'You are a customer service rep.',
      };

      const result = await buildVoiceLiveConfig(agent, 'proj_alpha', {});

      expect(result.model).toBeDefined();
      expect(result.voiceName).toBeDefined();
      expect(result.liveConfig.systemInstruction).toContain('You are a customer service rep.');
      expect(result.liveConfig.systemInstruction).toContain(
        'You are speaking with the user out loud'
      );

      const toolDecls = result.liveConfig.tools[0].functionDeclarations;
      const endCall = toolDecls.find((d) => d.name === 'end_call');
      expect(endCall).toBeDefined();
    });

    test('refuses to build LiveConnectConfig if agent has guarded tools', async () => {
      const agent = {
        _id: 'agent_guarded',
        interruptOn: { refund_payment: true },
      };

      await expect(buildVoiceLiveConfig(agent, 'proj_alpha', {})).rejects.toThrow(
        expect.objectContaining({
          code: 'VOICE_INTERRUPT_ON_UNSUPPORTED',
          statusCode: 422,
        })
      );
    });
  });
});
