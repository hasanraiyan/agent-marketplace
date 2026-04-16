import {
  createProviderSchema,
  updateProviderSchema,
} from '../src/validators/provider.validator.js';

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
  });
});
