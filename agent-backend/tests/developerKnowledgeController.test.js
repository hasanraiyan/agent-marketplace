import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/knowledge/knowledge.service.js', () => ({
  default: {
    createKnowledgeBase: jest.fn(),
    getKnowledgeBase: jest.fn(),
    updateKnowledgeBase: jest.fn(),
    deleteKnowledgeBase: jest.fn(),
    discoverKnowledgeBases: jest.fn(),
    uploadFiles: jest.fn(),
    searchKnowledgeBase: jest.fn(),
    deleteDocumentFromKb: jest.fn(),
    listDocumentSources: jest.fn(),
  },
}));

const knowledgeService = (await import('../src/modules/knowledge/knowledge.service.js')).default;
const developerKnowledgeController = (
  await import('../src/modules/developer/developerKnowledge.controller.js')
).default;

describe('Developer Knowledge Controller', () => {
  const machineContext = { domain: 'project-1', principalType: 'ProjectMachine' };

  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { projectContext: machineContext, body: {}, params: {}, query: {}, files: [] };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('upload', () => {
    test('400s with no service call when no files are attached', async () => {
      mockReq.files = [];

      await developerKnowledgeController.upload(mockReq, mockRes, next);

      expect(knowledgeService.uploadFiles).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('uploads via knowledgeService.uploadFiles, forwarding req.projectContext', async () => {
      mockReq.params = { kbId: 'kb1' };
      mockReq.files = [{ originalname: 'test.txt' }];
      knowledgeService.uploadFiles.mockResolvedValue({ files: [{ fileName: 'test.txt' }] });

      await developerKnowledgeController.upload(mockReq, mockRes, next);

      expect(knowledgeService.uploadFiles).toHaveBeenCalledWith(
        'kb1',
        undefined,
        mockReq.files,
        machineContext
      );
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('collapses "Not authorized to upload to this knowledge base" to a 404', async () => {
      mockReq.params = { kbId: 'kb1' };
      mockReq.files = [{ originalname: 'test.txt' }];
      knowledgeService.uploadFiles.mockRejectedValue(
        new Error('Not authorized to upload to this knowledge base')
      );

      await developerKnowledgeController.upload(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('search', () => {
    test('searches via knowledgeService.searchKnowledgeBase, forwarding req.projectContext', async () => {
      mockReq.params = { kbId: 'kb1' };
      mockReq.body = { query: 'hello', topK: 3 };
      knowledgeService.searchKnowledgeBase.mockResolvedValue([{ text: 'match' }]);

      await developerKnowledgeController.search(mockReq, mockRes, next);

      expect(knowledgeService.searchKnowledgeBase).toHaveBeenCalledWith(
        'kb1',
        'hello',
        { topK: 3 },
        machineContext
      );
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [{ text: 'match' }] });
    });

    test('collapses "Not authorized to access this knowledge base" to a 404', async () => {
      mockReq.params = { kbId: 'kb1' };
      knowledgeService.searchKnowledgeBase.mockRejectedValue(
        new Error('Not authorized to access this knowledge base')
      );

      await developerKnowledgeController.search(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteDocument', () => {
    test('deletes via knowledgeService.deleteDocumentFromKb, forwarding req.projectContext', async () => {
      mockReq.params = { kbId: 'kb1', sourceName: 'test.txt' };
      knowledgeService.deleteDocumentFromKb.mockResolvedValue({ removedChunks: 2 });

      await developerKnowledgeController.deleteDocument(mockReq, mockRes, next);

      expect(knowledgeService.deleteDocumentFromKb).toHaveBeenCalledWith(
        'kb1',
        undefined,
        'test.txt',
        machineContext
      );
    });
  });

  describe('listDocuments', () => {
    test('lists via knowledgeService.listDocumentSources, forwarding req.projectContext', async () => {
      mockReq.params = { kbId: 'kb1' };
      knowledgeService.listDocumentSources.mockResolvedValue([{ fileName: 'test.txt' }]);

      await developerKnowledgeController.listDocuments(mockReq, mockRes, next);

      expect(knowledgeService.listDocumentSources).toHaveBeenCalledWith(
        'kb1',
        undefined,
        machineContext
      );
    });
  });

  describe('discover', () => {
    test('discovers via knowledgeService.discoverKnowledgeBases using req.projectContext', async () => {
      mockReq.query = { search: 'docs', scope: 'mine' };
      knowledgeService.discoverKnowledgeBases.mockResolvedValue([{ _id: 'kb1' }]);

      await developerKnowledgeController.discover(mockReq, mockRes, next);

      expect(knowledgeService.discoverKnowledgeBases).toHaveBeenCalledWith(
        machineContext,
        { search: 'docs', scope: 'mine' },
        { page: 1, limit: 20 }
      );
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [{ _id: 'kb1' }] });
    });

    test('passes errors to next', async () => {
      const err = new Error('boom');
      knowledgeService.discoverKnowledgeBases.mockRejectedValue(err);

      await developerKnowledgeController.discover(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('create', () => {
    test('creates via knowledgeService.createKnowledgeBase using req.projectContext', async () => {
      mockReq.body = { name: 'Support KB', providerId: 'p1' };
      knowledgeService.createKnowledgeBase.mockResolvedValue({ _id: 'kb1', name: 'Support KB' });

      await developerKnowledgeController.create(mockReq, mockRes, next);

      expect(knowledgeService.createKnowledgeBase).toHaveBeenCalledWith(
        undefined,
        { name: 'Support KB', providerId: 'p1' },
        machineContext
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('passes errors to next (e.g. missing providerId)', async () => {
      const err = new Error(
        'providerId is required when creating a Knowledge Base via the Developer API'
      );
      knowledgeService.createKnowledgeBase.mockRejectedValue(err);

      await developerKnowledgeController.create(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('getOne', () => {
    test('returns the KB using the :kbId param and req.projectContext', async () => {
      mockReq.params = { kbId: 'kb1' };
      knowledgeService.getKnowledgeBase.mockResolvedValue({ _id: 'kb1' });

      await developerKnowledgeController.getOne(mockReq, mockRes, next);

      expect(knowledgeService.getKnowledgeBase).toHaveBeenCalledWith(
        'kb1',
        undefined,
        machineContext
      );
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: { _id: 'kb1' } });
    });

    test('collapses "Not authorized to access this knowledge base" to a 404, existence-hiding', async () => {
      mockReq.params = { kbId: 'kb1' };
      knowledgeService.getKnowledgeBase.mockRejectedValue(
        new Error('Not authorized to access this knowledge base')
      );

      await developerKnowledgeController.getOne(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });

    test('collapses "Knowledge base not found" to a 404', async () => {
      mockReq.params = { kbId: 'kb1' };
      knowledgeService.getKnowledgeBase.mockRejectedValue(new Error('Knowledge base not found'));

      await developerKnowledgeController.getOne(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    test('updates via knowledgeService.updateKnowledgeBase, forwarding req.projectContext', async () => {
      mockReq.params = { kbId: 'kb1' };
      mockReq.body = { description: 'new description' };
      knowledgeService.updateKnowledgeBase.mockResolvedValue({ _id: 'kb1' });

      await developerKnowledgeController.update(mockReq, mockRes, next);

      expect(knowledgeService.updateKnowledgeBase).toHaveBeenCalledWith(
        'kb1',
        undefined,
        { description: 'new description' },
        machineContext
      );
    });
  });

  describe('remove', () => {
    test('deletes via knowledgeService.deleteKnowledgeBase, forwarding req.projectContext', async () => {
      mockReq.params = { kbId: 'kb1' };
      knowledgeService.deleteKnowledgeBase.mockResolvedValue(true);

      await developerKnowledgeController.remove(mockReq, mockRes, next);

      expect(knowledgeService.deleteKnowledgeBase).toHaveBeenCalledWith(
        'kb1',
        undefined,
        machineContext
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Knowledge base deleted successfully',
      });
    });
  });
});
