import {
  createKnowledgeBaseSchema,
  updateKnowledgeBaseSchema,
  searchKnowledgeBaseSchema,
} from '../src/validators/knowledge.validator.js';

describe('Knowledge Validator', () => {
  describe('createKnowledgeBaseSchema', () => {
    test('should validate correct data', () => {
      const data = {
        name: 'My KB',
        description: 'valid description',
        isPublic: true,
        embeddingModel: 'text-embedding-3-small',
        providerId: '507f1f77bcf86cd799439011',
        chunkSize: 800,
        chunkOverlap: 100,
        topK: 5,
      };
      const parsed = createKnowledgeBaseSchema.parse(data);
      expect(parsed.name).toBe('My KB');
    });

    test('should fail if name is empty', () => {
      expect(() => createKnowledgeBaseSchema.parse({ name: '' })).toThrow();
    });
  });

  describe('updateKnowledgeBaseSchema', () => {
    test('should validate correct update fields', () => {
      const data = {
        name: 'New Name',
        description: 'New Description',
      };
      const parsed = updateKnowledgeBaseSchema.parse(data);
      expect(parsed.name).toBe('New Name');
    });
  });

  describe('searchKnowledgeBaseSchema', () => {
    test('should validate correct search data', () => {
      const data = {
        query: 'search query',
        topK: 10,
      };
      const parsed = searchKnowledgeBaseSchema.parse(data);
      expect(parsed.query).toBe('search query');
    });
  });
});
