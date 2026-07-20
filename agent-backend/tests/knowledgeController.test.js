import { jest } from '@jest/globals';

// Mock the service layer
jest.unstable_mockModule('../src/services/knowledge.service.js', () => ({
  default: {
    createKnowledgeBase: jest.fn(),
    listKnowledgeBases: jest.fn(),
    getKnowledgeBase: jest.fn(),
    updateKnowledgeBase: jest.fn(),
    deleteKnowledgeBase: jest.fn(),
    uploadFiles: jest.fn(),
    deleteDocumentFromKb: jest.fn(),
    listDocumentSources: jest.fn(),
    searchKnowledgeBase: jest.fn(),
  },
}));

const knowledgeService = (await import('../src/services/knowledge.service.js')).default;
const knowledgeController = (await import('../src/controllers/knowledge.controller.js')).default;

describe('Knowledge Controller', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  const mockUserId = 'user123';
  const mockKbId = 'kb123';

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: { id: mockUserId },
      body: {},
      params: {},
      files: [],
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('create', () => {
    test('should return 201 and created KB', async () => {
      const kbData = { name: 'New KB' };
      mockReq.body = kbData;
      knowledgeService.createKnowledgeBase.mockResolvedValue({ _id: mockKbId, ...kbData });

      await knowledgeController.create(mockReq, mockRes, mockNext);

      expect(knowledgeService.createKnowledgeBase).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining(kbData)
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining(kbData),
      });
    });

    test('should pass errors to next', async () => {
      const err = new Error('Service Error');
      knowledgeService.createKnowledgeBase.mockRejectedValue(err);

      await knowledgeController.create(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  describe('list', () => {
    test('should return all knowledge bases for user', async () => {
      const mockKbs = [{ _id: mockKbId, name: 'My KB' }];
      knowledgeService.listKnowledgeBases.mockResolvedValue(mockKbs);

      await knowledgeController.list(mockReq, mockRes, mockNext);

      expect(knowledgeService.listKnowledgeBases).toHaveBeenCalledWith(mockUserId);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockKbs,
      });
    });
  });

  describe('getOne', () => {
    test('should return knowledge base if found', async () => {
      const mockKb = { _id: mockKbId, name: 'My KB' };
      mockReq.params = { id: mockKbId };
      knowledgeService.getKnowledgeBase.mockResolvedValue(mockKb);

      await knowledgeController.getOne(mockReq, mockRes, mockNext);

      expect(knowledgeService.getKnowledgeBase).toHaveBeenCalledWith(mockKbId, mockUserId);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockKb,
      });
    });

    test('should return 404 if not found', async () => {
      mockReq.params = { id: mockKbId };
      knowledgeService.getKnowledgeBase.mockRejectedValue(new Error('Knowledge base not found'));

      await knowledgeController.getOne(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Knowledge base not found',
      });
    });

    test('should return 403 if unauthorized', async () => {
      mockReq.params = { id: mockKbId };
      knowledgeService.getKnowledgeBase.mockRejectedValue(
        new Error('Not authorized to access this knowledge base')
      );

      await knowledgeController.getOne(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Not authorized to access this knowledge base',
      });
    });
  });

  describe('update', () => {
    test('should update KB metadata', async () => {
      const updateData = { name: 'Updated name' };
      mockReq.params = { id: mockKbId };
      mockReq.body = updateData;
      knowledgeService.updateKnowledgeBase.mockResolvedValue({ _id: mockKbId, ...updateData });

      await knowledgeController.update(mockReq, mockRes, mockNext);

      expect(knowledgeService.updateKnowledgeBase).toHaveBeenCalledWith(
        mockKbId,
        mockUserId,
        updateData
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining(updateData),
      });
    });

    test('should handle controller errors', async () => {
      mockReq.params = { id: mockKbId };
      knowledgeService.updateKnowledgeBase.mockRejectedValue(
        new Error('No valid fields to update')
      );

      await knowledgeController.update(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('remove', () => {
    test('should delete KB successfully', async () => {
      mockReq.params = { id: mockKbId };
      knowledgeService.deleteKnowledgeBase.mockResolvedValue(true);

      await knowledgeController.remove(mockReq, mockRes, mockNext);

      expect(knowledgeService.deleteKnowledgeBase).toHaveBeenCalledWith(mockKbId, mockUserId);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Knowledge base deleted successfully',
      });
    });
  });

  describe('upload', () => {
    test('should upload files successfully', async () => {
      const mockResult = { files: [{ fileName: 'test.txt' }] };
      mockReq.params = { id: mockKbId };
      mockReq.files = [{ originalname: 'test.txt' }];
      knowledgeService.uploadFiles.mockResolvedValue(mockResult);

      await knowledgeController.upload(mockReq, mockRes, mockNext);

      expect(knowledgeService.uploadFiles).toHaveBeenCalledWith(
        mockKbId,
        mockUserId,
        mockReq.files
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        message: '1 file(s) processed successfully',
      });
    });

    test('should return 400 if no files uploaded', async () => {
      mockReq.params = { id: mockKbId };
      mockReq.files = [];

      await knowledgeController.upload(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'No files uploaded. Please select at least one file.',
        })
      );
    });
  });

  describe('deleteDocument', () => {
    test('should delete document source from KB', async () => {
      const mockResult = { removedChunks: 5 };
      mockReq.params = { id: mockKbId, sourceName: encodeURIComponent('test.txt') };
      knowledgeService.deleteDocumentFromKb.mockResolvedValue(mockResult);

      await knowledgeController.deleteDocument(mockReq, mockRes, mockNext);

      expect(knowledgeService.deleteDocumentFromKb).toHaveBeenCalledWith(
        mockKbId,
        mockUserId,
        'test.txt'
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        message: 'Document deleted. 5 chunk(s) removed.',
      });
    });
  });

  describe('listDocuments', () => {
    test('should list all source documents', async () => {
      const mockDocs = [{ fileName: 'test.txt' }];
      mockReq.params = { id: mockKbId };
      knowledgeService.listDocumentSources.mockResolvedValue(mockDocs);

      await knowledgeController.listDocuments(mockReq, mockRes, mockNext);

      expect(knowledgeService.listDocumentSources).toHaveBeenCalledWith(mockKbId, mockUserId);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockDocs,
      });
    });
  });

  describe('search', () => {
    test('should search KB and return matches', async () => {
      const mockMatches = [{ text: 'matched' }];
      mockReq.params = { id: mockKbId };
      mockReq.body = { query: 'test query', topK: 3 };
      knowledgeService.searchKnowledgeBase.mockResolvedValue(mockMatches);

      await knowledgeController.search(mockReq, mockRes, mockNext);

      expect(knowledgeService.searchKnowledgeBase).toHaveBeenCalledWith(mockKbId, 'test query', {
        topK: 3,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockMatches,
      });
    });
  });
});
