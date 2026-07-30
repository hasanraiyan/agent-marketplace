import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/files/file.repository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findBySubject: jest.fn(),
    deleteById: jest.fn(),
  },
}));

jest.unstable_mockModule('fs/promises', () => ({
  default: { unlink: jest.fn().mockResolvedValue(undefined) },
  unlink: jest.fn().mockResolvedValue(undefined),
}));

const fileRepository = (await import('../src/modules/files/file.repository.js')).default;
const { default: fileService } = await import('../src/modules/files/file.service.js');

describe('File Service (blueprint Phase 9 §15, PR-47d)', () => {
  const runtimeContext = {
    domain: 'project-1',
    principalType: 'ProjectRuntime',
    externalUserId: 'sabik',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createFile', () => {
    test('persists a file record scoped to the Runtime context Subject', async () => {
      fileRepository.create.mockResolvedValue({ _id: 'f1' });
      const multerFile = {
        filename: 'uuid-1.txt',
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        size: 42,
      };

      await fileService.createFile(runtimeContext, multerFile, { agentId: 'a1' });

      expect(fileRepository.create).toHaveBeenCalledWith({
        domain: 'project-1',
        externalUserId: 'sabik',
        agentId: 'a1',
        threadId: null,
        storageKey: 'uuid-1.txt',
        originalName: 'notes.txt',
        mimeType: 'text/plain',
        size: 42,
      });
    });
  });

  describe('getFileForDownload', () => {
    test('returns the file when domain + externalUserId match', async () => {
      fileRepository.findById.mockResolvedValue({
        _id: 'f1',
        domain: 'project-1',
        externalUserId: 'sabik',
      });

      const result = await fileService.getFileForDownload('f1', runtimeContext);
      expect(result._id).toBe('f1');
    });

    test('collapses a different Subject to "File not found" (existence-hiding)', async () => {
      fileRepository.findById.mockResolvedValue({
        _id: 'f1',
        domain: 'project-1',
        externalUserId: 'someone-else',
      });

      await expect(fileService.getFileForDownload('f1', runtimeContext)).rejects.toThrow(
        'File not found'
      );
    });

    test('collapses a different Domain to "File not found"', async () => {
      fileRepository.findById.mockResolvedValue({
        _id: 'f1',
        domain: 'project-2',
        externalUserId: 'sabik',
      });

      await expect(fileService.getFileForDownload('f1', runtimeContext)).rejects.toThrow(
        'File not found'
      );
    });

    test('collapses a nonexistent file to the same "File not found"', async () => {
      fileRepository.findById.mockResolvedValue(null);

      await expect(fileService.getFileForDownload('f1', runtimeContext)).rejects.toThrow(
        'File not found'
      );
    });
  });

  describe('listFiles', () => {
    test('lists via the Subject filter, not a bare id', async () => {
      fileRepository.findBySubject.mockResolvedValue([]);

      await fileService.listFiles(runtimeContext, { page: 1, limit: 20 });

      expect(fileRepository.findBySubject).toHaveBeenCalledWith(
        { domain: 'project-1', externalUserId: 'sabik' },
        { page: 1, limit: 20 }
      );
    });
  });

  describe('deleteFile', () => {
    test("rejects deleting a different Subject's file", async () => {
      fileRepository.findById.mockResolvedValue({
        _id: 'f1',
        domain: 'project-1',
        externalUserId: 'someone-else',
      });

      await expect(fileService.deleteFile('f1', runtimeContext)).rejects.toThrow('File not found');
      expect(fileRepository.deleteById).not.toHaveBeenCalled();
    });

    test('deletes the DB record for the owning Subject', async () => {
      fileRepository.findById.mockResolvedValue({
        _id: 'f1',
        domain: 'project-1',
        externalUserId: 'sabik',
        storageKey: 'uuid-1.txt',
      });
      fileRepository.deleteById.mockResolvedValue(true);

      const result = await fileService.deleteFile('f1', runtimeContext);

      expect(fileRepository.deleteById).toHaveBeenCalledWith('f1');
      expect(result).toBe(true);
    });
  });
});
