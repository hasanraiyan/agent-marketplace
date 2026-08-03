import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/files/file.service.js', () => ({
  default: {
    createFile: jest.fn(),
    getFileForDownload: jest.fn(),
    listFiles: jest.fn(),
    deleteFile: jest.fn(),
    countFiles: jest.fn(),
  },
  developerUploadDir: '/tmp/developer-uploads',
}));

const fileService = (await import('../src/modules/files/file.service.js')).default;
const developerFileController = (
  await import('../src/modules/developer/developerFile.controller.js')
).default;

describe('Developer File Controller', () => {
  const runtimeContext = {
    domain: 'project-1',
    principalType: 'ProjectRuntime',
    externalUserId: 'sabik',
  };

  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { projectContext: runtimeContext, body: {}, params: {}, query: {}, file: null };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      download: jest.fn(),
    };
    next = jest.fn();
  });

  describe('upload', () => {
    test('400s with no service call when no file is attached', async () => {
      mockReq.file = null;

      await developerFileController.upload(mockReq, mockRes, next);

      expect(fileService.createFile).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('creates via fileService.createFile, forwarding req.projectContext', async () => {
      mockReq.file = { filename: 'uuid-1.txt', originalname: 'notes.txt' };
      mockReq.body = { agentId: 'a1' };
      fileService.createFile.mockResolvedValue({
        _id: 'f1',
        originalName: 'notes.txt',
        mimeType: 'text/plain',
        size: 10,
        agentId: 'a1',
        threadId: null,
        createdAt: new Date(),
      });

      await developerFileController.upload(mockReq, mockRes, next);

      expect(fileService.createFile).toHaveBeenCalledWith(runtimeContext, mockReq.file, {
        agentId: 'a1',
        threadId: undefined,
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('list', () => {
    test('lists via fileService.listFiles, forwarding req.projectContext, wrapped in a pagination envelope', async () => {
      fileService.listFiles.mockResolvedValue([]);
      fileService.countFiles.mockResolvedValue(0);

      await developerFileController.list(mockReq, mockRes, next);

      expect(fileService.listFiles).toHaveBeenCalledWith(runtimeContext, { page: 1, limit: 20 });
      expect(fileService.countFiles).toHaveBeenCalledWith(runtimeContext);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { items: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } },
      });
    });
  });

  describe('download', () => {
    test('streams the file via res.download after mediated access check', async () => {
      mockReq.params = { fileId: 'f1' };
      fileService.getFileForDownload.mockResolvedValue({
        storageKey: 'uuid-1.txt',
        originalName: 'notes.txt',
      });

      await developerFileController.download(mockReq, mockRes, next);

      expect(fileService.getFileForDownload).toHaveBeenCalledWith('f1', runtimeContext);
      expect(mockRes.download).toHaveBeenCalledWith(
        expect.stringContaining('uuid-1.txt'),
        'notes.txt',
        expect.any(Function)
      );
    });

    test('collapses "File not found" to a 404, existence-hiding', async () => {
      mockReq.params = { fileId: 'f1' };
      fileService.getFileForDownload.mockRejectedValue(new Error('File not found'));

      await developerFileController.download(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.download).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    test('deletes via fileService.deleteFile, forwarding req.projectContext', async () => {
      mockReq.params = { fileId: 'f1' };
      fileService.deleteFile.mockResolvedValue(true);

      await developerFileController.remove(mockReq, mockRes, next);

      expect(fileService.deleteFile).toHaveBeenCalledWith('f1', runtimeContext);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'File deleted successfully',
      });
    });

    test('collapses "File not found" to a 404', async () => {
      mockReq.params = { fileId: 'f1' };
      fileService.deleteFile.mockRejectedValue(new Error('File not found'));

      await developerFileController.remove(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('bulkDelete', () => {
    test('deletes each id via fileService.deleteFile, splitting deleted/failed', async () => {
      mockReq.body = { ids: ['f1', 'f2'] };
      fileService.deleteFile.mockImplementation(async (id) => {
        if (id === 'f2') throw new Error('File not found');
        return true;
      });

      await developerFileController.bulkDelete(mockReq, mockRes, next);

      expect(fileService.deleteFile).toHaveBeenCalledWith('f1', runtimeContext);
      expect(fileService.deleteFile).toHaveBeenCalledWith('f2', runtimeContext);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          deleted: ['f1'],
          failed: [{ id: 'f2', reason: expect.any(String) }],
        },
      });
    });
  });
});
