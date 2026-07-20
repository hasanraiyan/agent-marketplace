import { jest } from '@jest/globals';

// Mock Config
jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    knowledge: {
      qdrantUrl: 'https://test-qdrant.io',
      qdrantApiKey: 'test-key',
      chunkSize: 800,
      chunkOverlap: 100,
      topK: 5,
    },
    ai: {
      openAiApiKey: 'global-openai-key',
    },
  },
}));

// Mock repositories
jest.unstable_mockModule('../src/repositories/knowledgeRepository.js', () => ({
  default: {
    createKb: jest.fn(),
    findKbById: jest.fn(),
    findKbsByUser: jest.fn(),
    updateKb: jest.fn(),
    deleteKb: jest.fn(),
    findKbsByIds: jest.fn(),
    insertChunks: jest.fn(),
    findChunksByKbId: jest.fn(),
    findChunksBySource: jest.fn(),
    countChunksByKbId: jest.fn(),
    deleteChunksByKbId: jest.fn(),
    getDocumentList: jest.fn(),
    deleteChunksBySource: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/repositories/providerRepository.js', () => ({
  default: {
    findById: jest.fn(),
    findByUser: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  default: {
    encrypt: jest.fn((v) => `enc:${v}`),
    decrypt: jest.fn((v) => String(v).replace(/^enc:/, '')),
  },
}));

// Mock pdf-parse
const mockGetText = jest.fn().mockResolvedValue({ text: 'parsed pdf text' });
jest.unstable_mockModule('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: mockGetText,
  })),
}));

// Mock langchain openai and qdrant
const mockEmbedDocuments = jest.fn();
jest.unstable_mockModule('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedDocuments: mockEmbedDocuments,
  })),
}));

const mockAddDocuments = jest.fn();
const mockSimilaritySearch = jest.fn();
jest.unstable_mockModule('@langchain/qdrant', () => ({
  QdrantVectorStore: {
    fromExistingCollection: jest.fn().mockResolvedValue({
      addDocuments: mockAddDocuments,
      similaritySearch: mockSimilaritySearch,
    }),
  },
}));

const mockCreateCollection = jest.fn();
const mockDeleteCollection = jest.fn();
const mockGetCollections = jest.fn().mockResolvedValue({ collections: [] });
const mockDeletePoints = jest.fn();
jest.unstable_mockModule('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    createCollection: mockCreateCollection,
    deleteCollection: mockDeleteCollection,
    getCollections: mockGetCollections,
    delete: mockDeletePoints,
  })),
}));

const config = (await import('../src/config/index.js')).default;
const knowledgeRepository = (await import('../src/repositories/knowledgeRepository.js')).default;
const providerRepository = (await import('../src/repositories/providerRepository.js')).default;
const encryption = (await import('../src/utils/encryption.js')).default;
const { PDFParse } = await import('pdf-parse');
const { OpenAIEmbeddings } = await import('@langchain/openai');
const { QdrantVectorStore } = await import('@langchain/qdrant');
const { QdrantClient } = await import('@qdrant/js-client-rest');

const { default: knowledgeService } = await import('../src/services/knowledge.service.js');

describe('Knowledge Service', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockKbId = '507f1f77bcf86cd799439022';
  let mockKb;
  let mockProvider;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProvider = {
      _id: '507f1f77bcf86cd799439033',
      label: 'OpenAI Test',
      apiKeyEncrypted: 'enc:test-provider-key',
      baseURL: 'https://api.openai.com/v1',
    };

    mockKb = {
      _id: mockKbId,
      name: 'Test Knowledge Base',
      description: 'Testing the service',
      ownerId: mockUserId,
      qdrantCollectionName: 'kb_507f1f77bcf86cd799439022_123456',
      embeddingModel: 'text-embedding-3-small',
      providerId: mockProvider._id,
      chunkSize: 800,
      chunkOverlap: 100,
      topK: 5,
      documentCount: 0,
      chunkCount: 0,
      documents: [],
      isPublic: false,
    };
  });

  describe('createKnowledgeBase', () => {
    test('should create knowledge base and Qdrant collection', async () => {
      providerRepository.findByUser.mockResolvedValue([mockProvider]);
      knowledgeRepository.createKb.mockResolvedValue(mockKb);
      knowledgeRepository.updateKb.mockResolvedValue({
        ...mockKb,
        qdrantCollectionName: 'kb_507f1f77bcf86cd799439022_real',
      });

      const kbData = {
        name: 'Test Knowledge Base',
        description: 'Testing the service',
        isPublic: false,
        embeddingModel: 'text-embedding-3-small',
        providerId: mockProvider._id,
        chunkSize: 800,
        chunkOverlap: 100,
        topK: 5,
      };

      const result = await knowledgeService.createKnowledgeBase(mockUserId, kbData);

      expect(knowledgeRepository.createKb).toHaveBeenCalled();
      expect(mockCreateCollection).toHaveBeenCalled();
      expect(knowledgeRepository.updateKb).toHaveBeenCalledWith(
        mockKb._id,
        expect.objectContaining({ qdrantCollectionName: expect.any(String) })
      );
      expect(mockDeleteCollection).toHaveBeenCalled(); // clean up temp collection
      expect(result.name).toBe('Test Knowledge Base');
    });

    test('should throw error if no provider is configured', async () => {
      providerRepository.findByUser.mockResolvedValue([]);
      await expect(
        knowledgeService.createKnowledgeBase(mockUserId, { name: 'KB' })
      ).rejects.toThrow('No AI provider found');
    });
  });

  describe('listKnowledgeBases', () => {
    test('should list knowledge bases for user', async () => {
      knowledgeRepository.findKbsByUser.mockResolvedValue([mockKb]);
      const result = await knowledgeService.listKnowledgeBases(mockUserId);
      expect(result).toEqual([mockKb]);
      expect(knowledgeRepository.findKbsByUser).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getKnowledgeBase', () => {
    test('should return knowledge base if owner', async () => {
      knowledgeRepository.findKbById.mockResolvedValue(mockKb);
      const result = await knowledgeService.getKnowledgeBase(mockKbId, mockUserId);
      expect(result).toEqual(mockKb);
    });

    test('should throw if not owner and not public', async () => {
      knowledgeRepository.findKbById.mockResolvedValue(mockKb);
      await expect(knowledgeService.getKnowledgeBase(mockKbId, 'other-user')).rejects.toThrow(
        'Not authorized'
      );
    });

    test('should return if public even if not owner', async () => {
      knowledgeRepository.findKbById.mockResolvedValue({ ...mockKb, isPublic: true });
      const result = await knowledgeService.getKnowledgeBase(mockKbId, 'other-user');
      expect(result.isPublic).toBe(true);
    });

    test('should throw if knowledge base not found', async () => {
      knowledgeRepository.findKbById.mockResolvedValue(null);
      await expect(knowledgeService.getKnowledgeBase(mockKbId, mockUserId)).rejects.toThrow(
        'Knowledge base not found'
      );
    });
  });

  describe('updateKnowledgeBase', () => {
    test('should update knowledge base metadata', async () => {
      knowledgeRepository.findKbById.mockResolvedValue(mockKb);
      knowledgeRepository.updateKb.mockResolvedValue({ ...mockKb, name: 'Updated Name' });

      const result = await knowledgeService.updateKnowledgeBase(mockKbId, mockUserId, {
        name: 'Updated Name',
      });

      expect(knowledgeRepository.updateKb).toHaveBeenCalledWith(mockKbId, { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    test('should throw if no valid fields to update', async () => {
      knowledgeRepository.findKbById.mockResolvedValue(mockKb);
      await expect(knowledgeService.updateKnowledgeBase(mockKbId, mockUserId, {})).rejects.toThrow(
        'No valid fields to update'
      );
    });
  });

  describe('deleteKnowledgeBase', () => {
    test('should delete knowledge base, chunks, and Qdrant collection', async () => {
      knowledgeRepository.findKbById.mockResolvedValue(mockKb);
      knowledgeRepository.deleteChunksByKbId.mockResolvedValue({});
      knowledgeRepository.deleteKb.mockResolvedValue(mockKb);

      const result = await knowledgeService.deleteKnowledgeBase(mockKbId, mockUserId);

      expect(knowledgeRepository.deleteChunksByKbId).toHaveBeenCalledWith(mockKbId);
      expect(knowledgeRepository.deleteKb).toHaveBeenCalledWith(mockKbId);
      expect(mockDeleteCollection).toHaveBeenCalledWith(mockKb.qdrantCollectionName);
      expect(result).toBe(true);
    });
  });

  describe('uploadFiles', () => {
    test('should extract text, chunk, embed, and index text and PDF files', async () => {
      knowledgeRepository.findKbById.mockResolvedValue(mockKb);
      providerRepository.findById.mockResolvedValue(mockProvider);
      mockAddDocuments.mockResolvedValue([]);
      knowledgeRepository.countChunksByKbId.mockResolvedValue(2);
      knowledgeRepository.insertChunks.mockResolvedValue([]);
      knowledgeRepository.updateKb.mockResolvedValue(mockKb);

      const mockTextFile = {
        buffer: Buffer.from('hello world content text file'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 100,
      };

      const mockPdfFile = {
        buffer: Buffer.from('mock pdf content'),
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 200,
      };

      const result = await knowledgeService.uploadFiles(mockKbId, mockUserId, [
        mockTextFile,
        mockPdfFile,
      ]);

      expect(knowledgeRepository.findKbById).toHaveBeenCalledWith(mockKbId);
      expect(mockCreateCollection).toHaveBeenCalledWith(
        mockKb.qdrantCollectionName,
        expect.objectContaining({
          vectors: expect.objectContaining({
            distance: 'Cosine',
            size: 1536,
          }),
        })
      );
      expect(mockAddDocuments).toHaveBeenCalled();
      expect(knowledgeRepository.insertChunks).toHaveBeenCalled();
      expect(knowledgeRepository.updateKb).toHaveBeenCalled();
      expect(result.files).toHaveLength(2);
    });

    test('should throw error for unsupported files', async () => {
      knowledgeRepository.findKbById.mockResolvedValue(mockKb);
      const mockUnsupportedFile = {
        buffer: Buffer.from(''),
        originalname: 'test.exe',
        mimetype: 'application/x-msdownload',
        size: 100,
      };

      await expect(
        knowledgeService.uploadFiles(mockKbId, mockUserId, [mockUnsupportedFile])
      ).rejects.toThrow('Unsupported file type');
    });
  });

  describe('searchKnowledgeBase', () => {
    test('should search vector store and return results', async () => {
      knowledgeRepository.findKbById.mockResolvedValue(mockKb);
      mockSimilaritySearch.mockResolvedValue([
        {
          pageContent: 'matched text content',
          metadata: { sourceName: 'test.txt', score: 0.85 },
        },
      ]);

      const result = await knowledgeService.searchKnowledgeBase(mockKbId, 'test query');

      expect(mockSimilaritySearch).toHaveBeenCalledWith('test query', 5);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('matched text content');
      expect(result[0].source).toBe('test.txt');
    });

    test('should handle JSON query string input', async () => {
      knowledgeRepository.findKbById.mockResolvedValue(mockKb);
      mockSimilaritySearch.mockResolvedValue([]);

      await knowledgeService.searchKnowledgeBase(mockKbId, JSON.stringify({ query: 'hello' }));
      expect(mockSimilaritySearch).toHaveBeenCalledWith('hello', 5);
    });
  });

  describe('deleteDocumentFromKb', () => {
    test('should delete document chunks and remove from Qdrant and MongoDB', async () => {
      const mockChunks = [
        { _id: 'chunk1', qdrantPointId: 'uuid-1', metadata: { sourceName: 'test.txt' } },
        { _id: 'chunk2', qdrantPointId: 'uuid-2', metadata: { sourceName: 'test.txt' } },
      ];
      knowledgeRepository.findKbById.mockResolvedValue({
        ...mockKb,
        documents: [{ fileName: 'test.txt', fileSize: 100 }],
      });
      knowledgeRepository.findChunksBySource.mockResolvedValue(mockChunks);
      knowledgeRepository.deleteChunksBySource.mockResolvedValue({});
      knowledgeRepository.countChunksByKbId.mockResolvedValue(0);
      knowledgeRepository.updateKb.mockResolvedValue(mockKb);

      const result = await knowledgeService.deleteDocumentFromKb(mockKbId, mockUserId, 'test.txt');

      expect(knowledgeRepository.findChunksBySource).toHaveBeenCalledWith(mockKbId, 'test.txt');
      expect(mockDeletePoints).toHaveBeenCalledWith(
        mockKb.qdrantCollectionName,
        expect.objectContaining({ points: ['uuid-1', 'uuid-2'] })
      );
      expect(knowledgeRepository.deleteChunksBySource).toHaveBeenCalledWith(mockKbId, 'test.txt');
      expect(result.removedChunks).toBe(2);
    });
  });

  describe('listDocumentSources', () => {
    test('should list document sources', async () => {
      knowledgeRepository.findKbById.mockResolvedValue({
        ...mockKb,
        documents: [{ fileName: 'test.txt', fileSize: 100 }],
      });
      const result = await knowledgeService.listDocumentSources(mockKbId, mockUserId);
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('test.txt');
    });
  });
});
