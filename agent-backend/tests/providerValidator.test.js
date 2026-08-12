import {
  createProviderSchema,
  updateProviderSchema,
} from '../src/modules/providers/provider.validator.js';

describe('Provider Validator', () => {
  describe('createProviderSchema', () => {
    it('should validate correct provider data', () => {
      const validData = {
        label: 'My OpenAI',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-1234567890abcdef',
        defaultModel: 'gpt-4',
        isDefault: true,
      };

      const result = createProviderSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should fail if required fields are missing', () => {
      const invalidData = {
        baseURL: 'https://api.openai.com/v1',
        // missing label, apiKey, defaultModel
      };

      const result = createProviderSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues.length).toBeGreaterThan(0);
    });

    it('should fail if baseURL is not a valid URL', () => {
      const invalidData = {
        label: 'My OpenAI',
        baseURL: 'not-a-url',
        apiKey: 'sk-1234',
        defaultModel: 'gpt-4',
      };

      const result = createProviderSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Must be a valid URL');
    });

    it('should pass with default isDefault if omitted', () => {
      const omitIsDefault = {
        label: 'My OpenAI',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-1234567890abcdef',
        defaultModel: 'gpt-4',
      };

      const result = createProviderSchema.parse(omitIsDefault);
      expect(result.isDefault).toBe(false);
    });

    it('should default type to custom if omitted', () => {
      const result = createProviderSchema.parse({
        label: 'My OpenAI',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-1234567890abcdef',
        defaultModel: 'gpt-4',
      });
      expect(result.type).toBe('custom');
    });

    it('should fail if type is custom and baseURL is missing', () => {
      const result = createProviderSchema.safeParse({
        label: 'My Custom',
        type: 'custom',
        apiKey: 'sk-1234567890abcdef',
        defaultModel: 'gpt-4',
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toEqual(['baseURL']);
    });

    it('should pass for a native type without baseURL', () => {
      const result = createProviderSchema.safeParse({
        label: 'My Anthropic',
        type: 'anthropic',
        apiKey: 'sk-ant-1234567890abcdef',
        defaultModel: 'claude-sonnet-4-6',
      });
      expect(result.success).toBe(true);
    });

    it('should reject an unknown type value', () => {
      const result = createProviderSchema.safeParse({
        label: 'My Provider',
        type: 'not-a-real-type',
        apiKey: 'sk-1234567890abcdef',
        defaultModel: 'gpt-4',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateProviderSchema', () => {
    it('should allow partial updates', () => {
      const validData = {
        label: 'New Label',
      };

      const result = updateProviderSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should fail if empty strings are passed for required constraints', () => {
      const invalidData = {
        label: '', // min 1
      };

      const result = updateProviderSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail if invalid URL is passed', () => {
      const invalidData = {
        baseURL: 'localhost',
      };

      const result = updateProviderSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should allow switching to a native type without baseURL', () => {
      const result = updateProviderSchema.safeParse({ type: 'gemini' });
      expect(result.success).toBe(true);
    });

    it('should fail switching to custom without a baseURL', () => {
      const result = updateProviderSchema.safeParse({ type: 'custom' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toEqual(['baseURL']);
    });

    it('should not require baseURL when type is not part of the update', () => {
      const result = updateProviderSchema.safeParse({ label: 'Renamed' });
      expect(result.success).toBe(true);
    });
  });
});
