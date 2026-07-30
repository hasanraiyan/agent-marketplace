import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/knowledge/knowledge.service.js', () => ({
  default: {
    createKnowledgeBase: jest.fn(),
    getKnowledgeBase: jest.fn(),
    updateKnowledgeBase: jest.fn(),
    deleteKnowledgeBase: jest.fn(),
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
    mockReq = { projectContext: machineContext, body: {}, params: {} };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
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
