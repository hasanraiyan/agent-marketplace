import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/stores/store.service.js', () => ({
  default: {
    createStore: jest.fn(),
    listStores: jest.fn(),
    countStores: jest.fn(),
    getStoreById: jest.fn(),
    updateStore: jest.fn(),
    deleteStore: jest.fn(),
    listStoreFiles: jest.fn(),
    getStoreFile: jest.fn(),
    writeStoreFile: jest.fn(),
    deleteStoreFile: jest.fn(),
  },
  EXTERNAL_USER_REQUIRED_MESSAGE:
    'This store requires an asserted external user (x-persona-external-user-id)',
}));

const storeService = (await import('../src/modules/stores/store.service.js')).default;
const developerStoreController = (
  await import('../src/modules/developer/developerStore.controller.js')
).default;

describe('Developer Store Controller', () => {
  const runtimeContext = { domain: 'proj-1', principalType: 'ProjectRuntime', externalUserId: 'sabik' };
  const machineContext = { domain: 'proj-1', principalType: 'ProjectMachine' };

  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { projectContext: machineContext, body: {}, params: {}, query: {} };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
    next = jest.fn();
  });

  test('create works with a bare Project (machine) credential — config is not per-founder', async () => {
    mockReq.body = { name: 'notes', scope: 'domain' };
    storeService.createStore.mockResolvedValue({ _id: 's1', name: 'notes' });

    await developerStoreController.create(mockReq, mockRes, next);

    expect(storeService.createStore).toHaveBeenCalledWith('proj-1', { name: 'notes', scope: 'domain' });
    expect(mockRes.status).toHaveBeenCalledWith(201);
  });

  test('create 409s on a duplicate name', async () => {
    storeService.createStore.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

    await developerStoreController.create(mockReq, mockRes, next);

    expect(mockRes.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });

  test('getOne 404s when the store does not exist', async () => {
    storeService.getStoreById.mockRejectedValue(new Error('Store not found'));

    await developerStoreController.getOne(mockReq, mockRes, next);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  describe('file routes — the externalUser guard is per-store, not a static router rule', () => {
    test('getFile works with a bare machine credential for a domain-scoped store', async () => {
      mockReq.query = { path: '/a.md' };
      storeService.getStoreFile.mockResolvedValue({ path: '/a.md', content: 'hi' });

      await developerStoreController.getFile(mockReq, mockRes, next);

      expect(storeService.getStoreFile).toHaveBeenCalledWith('proj-1', undefined, undefined, '/a.md');
      expect(mockRes.status).not.toHaveBeenCalledWith(400);
    });

    test('getFile 400s when the resolved store is externalUser-scoped and no external user was asserted', async () => {
      mockReq.query = { path: '/a.md' };
      storeService.getStoreFile.mockRejectedValue(
        new Error('This store requires an asserted external user (x-persona-external-user-id)')
      );

      await developerStoreController.getFile(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('getFile succeeds with a ProjectRuntime credential asserting an external user', async () => {
      mockReq.projectContext = runtimeContext;
      mockReq.query = { path: '/a.md' };
      storeService.getStoreFile.mockResolvedValue({ path: '/a.md', content: 'hi' });

      await developerStoreController.getFile(mockReq, mockRes, next);

      expect(storeService.getStoreFile).toHaveBeenCalledWith('proj-1', undefined, 'sabik', '/a.md');
    });

    test('writeFile 400s without path/content', async () => {
      mockReq.body = { path: '/a.md' };

      await developerStoreController.writeFile(mockReq, mockRes, next);

      expect(storeService.writeStoreFile).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('removeFile 204s on success', async () => {
      mockReq.query = { path: '/a.md' };
      storeService.deleteStoreFile.mockResolvedValue(undefined);

      await developerStoreController.removeFile(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(204);
    });
  });
});
