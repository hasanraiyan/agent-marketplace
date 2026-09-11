import { searchAgentSchema, createAgentSchema, updateAgentSchema } from '../src/modules/agents/agent.validator.js';

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
      expect(result.data.agentType).toBe('deepagent'); // default
    });

    it('should accept valid agentType: react and deepagent', () => {
      const reactAgent = {
        name: 'React Assistant',
        systemPrompt: 'You are a lightweight react agent.',
        providerId: 'some_id',
        agentType: 'react',
      };
      const result = createAgentSchema.safeParse(reactAgent);
      expect(result.success).toBe(true);
      expect(result.data.agentType).toBe('react');

      const deepAgent = {
        name: 'Deep Assistant',
        systemPrompt: 'You are a deep agent.',
        providerId: 'some_id',
        agentType: 'deepagent',
      };
      const result2 = createAgentSchema.safeParse(deepAgent);
      expect(result2.success).toBe(true);
      expect(result2.data.agentType).toBe('deepagent');
    });

    it('should reject invalid agentType', () => {
      const invalid = {
        name: 'Bad Agent',
        systemPrompt: 'You are an invalid agent.',
        providerId: 'some_id',
        agentType: 'invalid_type',
      };
      const result = createAgentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
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

  describe('updateAgentSchema', () => {
    it('should allow optional agentType update', () => {
      const updateReact = { agentType: 'react' };
      const result = updateAgentSchema.safeParse(updateReact);
      expect(result.success).toBe(true);
      expect(result.data.agentType).toBe('react');

      const updateDeep = { agentType: 'deepagent' };
      const result2 = updateAgentSchema.safeParse(updateDeep);
      expect(result2.success).toBe(true);
      expect(result2.data.agentType).toBe('deepagent');
    });

    it('should reject invalid agentType on update', () => {
      const invalid = { agentType: 'not_valid' };
      const result = updateAgentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
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
