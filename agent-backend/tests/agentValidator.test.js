import { searchAgentSchema, createAgentSchema } from '../src/modules/agents/agent.validator.js';

describe('Agent Validator', () => {
  describe('createAgentSchema', () => {
    it('should validate complete agent profile', () => {
      const valid = {
        name: 'JS Assistant',
        description: 'Helps with js',
        systemPrompt: 'You are a cool js expert. Act like one.',
        providerId: 'some_id',
        category: 'coding',
      };
      const result = createAgentSchema.safeParse(valid);
      expect(result.success).toBe(true);
      expect(result.data.visibility).toBe('private'); // default
      expect(result.data.webSearchEnabled).toBe(false); // default
    });

    it('should block extremely short system prompts for safety', () => {
      const invalid = {
        name: 'JS',
        systemPrompt: 'hi', // Under 10 chars
        providerId: 'some_id',
      };
      const result = createAgentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('at least 10 characters');
    });
  });

  describe('searchAgentSchema', () => {
    it('should extract pagination defaults', () => {
      const result = searchAgentSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortBy).toBe('newest');
    });

    it('should accept valid search query', () => {
      const filter = {
        category: 'coding',
        visibility: 'public',
        search: 'react expert',
      };
      const result = searchAgentSchema.safeParse(filter);
      expect(result.success).toBe(true);
    });
  });
});
