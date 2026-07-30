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
jest.unstable_mockModule('../src/modules/knowledge/knowledge.repository.js', () => ({
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
    searchKbs: jest.fn(),
    countKbs: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/providers/provider.repository.js', () => ({
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
const knowledgeRepository = (await import('../src/modules/knowledge/knowledge.repository.js'))
  .default;
const providerRepository = (await import('../src/modules/providers/provider.repository.js'))
  .default;
const encryption = (await import('../src/utils/encryption.js')).default;
const { PDFParse } = await import('pdf-parse');
const { OpenAIEmbeddings } = await import('@langchain/openai');
const { QdrantVectorStore } = await import('@langchain/qdrant');
const { QdrantClient } = await import('@qdrant/js-client-rest');

const { default: knowledgeService } = await import('../src/modules/knowledge/knowledge.service.js');

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

    test('Developer Platform (PR-31): creates a Project-owned KB for a ProjectMachineContext with an explicit providerId', async () => {
      knowledgeRepository.createKb.mockResolvedValue(mockKb);
      knowledgeRepository.updateKb.mockResolvedValue(mockKb);
      const context = { domain: 'project-1', principalType: 'ProjectMachine' };

      await knowledgeService.createKnowledgeBase(
        'irrelevant',
        { name: 'Support KB', providerId: mockProvider._id },
        context
      );

      expect(knowledgeRepository.createKb).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'project-1', ownerType: 'Project' })
      );
      // Persona's own-provider auto-resolution must never run for a
      // non-Persona context.
      expect(providerRepository.findByUser).not.toHaveBeenCalled();
    });

    test('Developer Platform (PR-31): rejects a ProjectRuntimeContext that omits providerId — no "my default provider" concept exists for it', async () => {
      const context = {
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'sabik',
      };

      await expect(
        knowledgeService.createKnowledgeBase('irrelevant', { name: 'My KB' }, context)
      ).rejects.toThrow(
        'providerId is required when creating a Knowledge Base via the Developer API'
      );
      expect(knowledgeRepository.createKb).not.toHaveBeenCalled();
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

    test('Developer Platform (PR-31): the owning ExternalUser context can see its own private KB', async () => {
      knowledgeRepository.findKbById.mockResolvedValue({
        ...mockKb,
        ownerId: undefined,
        ownerType: 'ExternalUser',
        externalOwnerId: 'sabik',
        domain: 'project-1',
      });
      const context = {
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'sabik',
      };

      const result = await knowledgeService.getKnowledgeBase(mockKbId, 'irrelevant', context);
      expect(result).toBeDefined();
    });

    test('Developer Platform (PR-31): a different external user cannot see the private KB', async () => {
      knowledgeRepository.findKbById.mockResolvedValue({
        ...mockKb,
        ownerId: undefined,
        ownerType: 'ExternalUser',
        externalOwnerId: 'sabik',
        domain: 'project-1',
      });
      const context = {
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'someone_else',
      };

      await expect(
        knowledgeService.getKnowledgeBase(mockKbId, 'irrelevant', context)
      ).rejects.toThrow('Not authorized to access this knowledge base');
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

    test('Developer Platform (PR-31): a ProjectMachineContext can update its own Project-owned KB', async () => {
      const projectKb = {
        ...mockKb,
        ownerId: undefined,
        ownerType: 'Project',
        domain: 'project-1',
      };
      knowledgeRepository.findKbById.mockResolvedValue(projectKb);
      knowledgeRepository.updateKb.mockResolvedValue({ ...projectKb, name: 'Renamed' });
      const context = { domain: 'project-1', principalType: 'ProjectMachine' };

      const result = await knowledgeService.updateKnowledgeBase(
        mockKbId,
        'irrelevant',
        { name: 'Renamed' },
        context
      );
      expect(result.name).toBe('Renamed');
    });

    test('Developer Platform (PR-31): a ProjectMachineContext from a DIFFERENT Domain is rejected', async () => {
      const projectKb = {
        ...mockKb,
        ownerId: undefined,
        ownerType: 'Project',
        domain: 'project-1',
      };
      knowledgeRepository.findKbById.mockResolvedValue(projectKb);
      const context = { domain: 'project-2', principalType: 'ProjectMachine' };

      await expect(
        knowledgeService.updateKnowledgeBase(mockKbId, 'irrelevant', { name: 'Renamed' }, context)
      ).rejects.toThrow('Not authorized to update this knowledge base');
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

    test('Developer Platform (PR-31): an ExternalUser context can delete its own KB', async () => {
      const externalKb = {
        ...mockKb,
        ownerId: undefined,
        ownerType: 'ExternalUser',
        externalOwnerId: 'sabik',
        domain: 'project-1',
      };
      knowledgeRepository.findKbById.mockResolvedValue(externalKb);
      knowledgeRepository.deleteChunksByKbId.mockResolvedValue({});
      knowledgeRepository.deleteKb.mockResolvedValue(externalKb);
      const context = {
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'sabik',
      };

      const result = await knowledgeService.deleteKnowledgeBase(mockKbId, 'irrelevant', context);
      expect(result).toBe(true);
    });

    test('Developer Platform (PR-31): a different external user is rejected before any deletion side effects', async () => {
      const externalKb = {
        ...mockKb,
        ownerId: undefined,
        ownerType: 'ExternalUser',
        externalOwnerId: 'sabik',
        domain: 'project-1',
      };
      knowledgeRepository.findKbById.mockResolvedValue(externalKb);
      const context = {
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'someone_else',
      };

      await expect(
        knowledgeService.deleteKnowledgeBase(mockKbId, 'irrelevant', context)
      ).rejects.toThrow('Not authorized to delete this knowledge base');
      expect(knowledgeRepository.deleteKb).not.toHaveBeenCalled();
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

    test('blueprint Phase 9, PR-47b: rejects a different Project uploading to a Project-owned KB', async () => {
      knowledgeRepository.findKbById.mockResolvedValue({
        ...mockKb,
        ownerId: undefined,
        domain: 'project-1',
        ownerType: 'Project',
      });

      await expect(
        knowledgeService.uploadFiles(
          mockKbId,
          'irrelevant',
          [{ buffer: Buffer.from('x'), originalname: 'test.txt', mimetype: 'text/plain', size: 1 }],
          { domain: 'project-2', principalType: 'ProjectMachine' }
        )
      ).rejects.toThrow('Not authorized to upload to this knowledge base');
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

    test('blueprint Phase 9, PR-47b: no context (Persona call site) skips the ownership check entirely, unchanged', async () => {
      knowledgeRepository.findKbById.mockResolvedValue({ ...mockKb, ownerId: 'someone-else' });
      mockSimilaritySearch.mockResolvedValue([]);

      await expect(knowledgeService.searchKnowledgeBase(mockKbId, 'test query')).resolves.toEqual(
        []
      );
    });

    test('blueprint Phase 9, PR-47b: an explicit context enforces owner-or-public', async () => {
      knowledgeRepository.findKbById.mockResolvedValue({
        ...mockKb,
        ownerId: undefined,
        domain: 'project-1',
        ownerType: 'Project',
        isPublic: false,
      });

      await expect(
        knowledgeService.searchKnowledgeBase(
          mockKbId,
          'test query',
          {},
          {
            domain: 'project-2',
            principalType: 'ProjectMachine',
          }
        )
      ).rejects.toThrow('Not authorized to access this knowledge base');
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

    test('blueprint Phase 9, PR-47b: rejects a different Project deleting a document from a Project-owned KB', async () => {
      knowledgeRepository.findKbById.mockResolvedValue({
        ...mockKb,
        ownerId: undefined,
        domain: 'project-1',
        ownerType: 'Project',
      });

      await expect(
        knowledgeService.deleteDocumentFromKb(mockKbId, 'irrelevant', 'test.txt', {
          domain: 'project-2',
          principalType: 'ProjectMachine',
        })
      ).rejects.toThrow('Not authorized to modify this knowledge base');
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

    test('blueprint Phase 9, PR-47b: a Project owner can list its own private KB documents', async () => {
      knowledgeRepository.findKbById.mockResolvedValue({
        ...mockKb,
        ownerId: undefined,
        domain: 'project-1',
        ownerType: 'Project',
        isPublic: false,
        documents: [{ fileName: 'test.txt', fileSize: 100 }],
      });

      const result = await knowledgeService.listDocumentSources(mockKbId, 'irrelevant', {
        domain: 'project-1',
        principalType: 'ProjectMachine',
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('discoverKnowledgeBases / countDiscoverKnowledgeBases (blueprint Phase 9, PR-45, AD-07 §19)', () => {
    const machineContext = { domain: 'project-1', principalType: 'ProjectMachine' };
    const runtimeContext = {
      domain: 'project-1',
      principalType: 'ProjectRuntime',
      externalUserId: 'sabik',
    };

    test('ProjectMachineContext ("Project discovery") scopes to the Domain only', async () => {
      knowledgeRepository.searchKbs.mockResolvedValue([]);

      await knowledgeService.discoverKnowledgeBases(machineContext, {}, { page: 1, limit: 20 });

      expect(knowledgeRepository.searchKbs).toHaveBeenCalledWith(
        { domain: 'project-1' },
        { page: 1, limit: 20 }
      );
    });

    test("ProjectRuntimeContext with scope=mine restricts to that external user's own KBs", async () => {
      knowledgeRepository.searchKbs.mockResolvedValue([]);

      await knowledgeService.discoverKnowledgeBases(runtimeContext, { scope: 'mine' }, {});

      expect(knowledgeRepository.searchKbs).toHaveBeenCalledWith(
        { domain: 'project-1', ownerType: 'ExternalUser', externalOwnerId: 'sabik' },
        {}
      );
    });

    test('ProjectRuntimeContext without scope=mine is "Project-public browse" — public KBs only', async () => {
      knowledgeRepository.searchKbs.mockResolvedValue([]);

      await knowledgeService.discoverKnowledgeBases(runtimeContext, {}, {});

      expect(knowledgeRepository.searchKbs).toHaveBeenCalledWith(
        { domain: 'project-1', isPublic: true },
        {}
      );
    });

    test('countDiscoverKnowledgeBases uses the identical filter-building logic', async () => {
      knowledgeRepository.countKbs.mockResolvedValue(2);

      const total = await knowledgeService.countDiscoverKnowledgeBases(machineContext, {});

      expect(knowledgeRepository.countKbs).toHaveBeenCalledWith({ domain: 'project-1' });
      expect(total).toBe(2);
    });
  });
});
