import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/memory/memory.service.js', () => ({
  default: {
    getAllMemory: jest.fn(),
    getMemoryFile: jest.fn(),
    writeMemoryFile: jest.fn(),
    deleteMemoryFile: jest.fn(),
  },
}));

const memoryService = (await import('../src/modules/memory/memory.service.js')).default;
const developerMemoryController = (
  await import('../src/modules/developer/developerMemory.controller.js')
).default;

describe('Developer Memory Controller (REQ-3)', () => {
  // agent.factory.js's identityKey for this same ProjectRuntime caller would
  // be `${domain}:${externalUserId}` = 'project-1:sabik' — every assertion
  // below checks the controller composes and passes THAT, not the bare
  // externalUserId, or a live agent run and this API would silently read/
  // write different namespaces for the same subject.
  const runtimeContext = {
    domain: 'project-1',
    principalType: 'ProjectRuntime',
    externalUserId: 'sabik',
  };
  const expectedIdentityKey = 'project-1:sabik';

  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { projectContext: runtimeContext, body: {}, query: {}, headers: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
    next = jest.fn();
  });

  describe('list', () => {
    test('calls getAllMemory with the composed identityKey, not the bare externalUserId', async () => {
      memoryService.getAllMemory.mockResolvedValue({ userFiles: [], agentMemories: [] });

      await developerMemoryController.list(mockReq, mockRes, next);

      expect(memoryService.getAllMemory).toHaveBeenCalledWith(expectedIdentityKey);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { userFiles: [], agentMemories: [] },
      });
    });
  });

  describe('getFile', () => {
    test('400s when path is missing', async () => {
      await developerMemoryController.getFile(mockReq, mockRes, next);

      expect(memoryService.getMemoryFile).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('reads via the composed identityKey', async () => {
      mockReq.query = { path: '/memories/user/index.md' };
      memoryService.getMemoryFile.mockResolvedValue({ path: '/memories/user/index.md', content: 'hi' });

      await developerMemoryController.getFile(mockReq, mockRes, next);

      expect(memoryService.getMemoryFile).toHaveBeenCalledWith(expectedIdentityKey, {
        scope: undefined,
        agentId: undefined,
        path: '/memories/user/index.md',
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { path: '/memories/user/index.md', content: 'hi' },
      });
    });

    test('prefers the x-agent-id header over the agentId query param', async () => {
      mockReq.query = { path: '/x.md', scope: 'agent', agentId: 'from-query' };
      mockReq.headers = { 'x-agent-id': 'from-header' };
      memoryService.getMemoryFile.mockResolvedValue({});

      await developerMemoryController.getFile(mockReq, mockRes, next);

      expect(memoryService.getMemoryFile).toHaveBeenCalledWith(
        expectedIdentityKey,
        expect.objectContaining({ agentId: 'from-header' })
      );
    });

    test('404s on "Memory file not found"', async () => {
      mockReq.query = { path: '/missing.md' };
      memoryService.getMemoryFile.mockRejectedValue(new Error('Memory file not found'));

      await developerMemoryController.getFile(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('writeFile', () => {
    test('400s when path or content is missing', async () => {
      mockReq.body = { path: '/x.md' };

      await developerMemoryController.writeFile(mockReq, mockRes, next);

      expect(memoryService.writeMemoryFile).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('400s when scope is "agent" with no agentId', async () => {
      mockReq.body = { path: '/x.md', content: 'hi', scope: 'agent' };

      await developerMemoryController.writeFile(mockReq, mockRes, next);

      expect(memoryService.writeMemoryFile).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('writes via the composed identityKey', async () => {
      mockReq.body = { path: '/memories/user/index.md', content: 'hi' };
      memoryService.writeMemoryFile.mockResolvedValue({ path: '/memories/user/index.md', content: 'hi' });

      await developerMemoryController.writeFile(mockReq, mockRes, next);

      expect(memoryService.writeMemoryFile).toHaveBeenCalledWith(expectedIdentityKey, {
        scope: undefined,
        agentId: undefined,
        path: '/memories/user/index.md',
        content: 'hi',
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('removeFile', () => {
    test('400s when path is missing', async () => {
      await developerMemoryController.removeFile(mockReq, mockRes, next);

      expect(memoryService.deleteMemoryFile).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('deletes via the composed identityKey and responds 204', async () => {
      mockReq.query = { path: '/memories/user/index.md' };
      memoryService.deleteMemoryFile.mockResolvedValue(undefined);

      await developerMemoryController.removeFile(mockReq, mockRes, next);

      expect(memoryService.deleteMemoryFile).toHaveBeenCalledWith(expectedIdentityKey, {
        scope: undefined,
        agentId: undefined,
        path: '/memories/user/index.md',
      });
      expect(mockRes.status).toHaveBeenCalledWith(204);
    });

    test('404s on "Memory file not found"', async () => {
      mockReq.query = { path: '/missing.md' };
      memoryService.deleteMemoryFile.mockRejectedValue(new Error('Memory file not found'));

      await developerMemoryController.removeFile(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
