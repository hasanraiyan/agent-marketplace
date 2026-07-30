import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/providers/provider.service.js', () => ({
  default: {
    createProvider: jest.fn(),
    getProviderById: jest.fn(),
    updateProvider: jest.fn(),
    deleteProvider: jest.fn(),
    testConnection: jest.fn(),
    getAvailableModels: jest.fn(),
  },
}));

const providerService = (await import('../src/modules/providers/provider.service.js')).default;
const developerProviderController = (
  await import('../src/modules/developer/developerProvider.controller.js')
).default;

describe('Developer Provider Controller', () => {
  const machineContext = { domain: 'project-1', principalType: 'ProjectMachine' };
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
    mockReq = { projectContext: machineContext, body: {}, params: {} };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('testConnection', () => {
    test('tests via providerService.testConnection, forwarding req.projectContext', async () => {
      mockReq.params = { providerId: 'p1' };
      providerService.testConnection.mockResolvedValue({ success: true, message: 'ok' });

      await developerProviderController.testConnection(mockReq, mockRes, next);

      expect(providerService.testConnection).toHaveBeenCalledWith('p1', undefined, machineContext);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { success: true, message: 'ok' },
      });
    });

    test('collapses "Provider not found" to a 404, existence-hiding', async () => {
      mockReq.params = { providerId: 'p1' };
      providerService.testConnection.mockRejectedValue(new Error('Provider not found'));

      await developerProviderController.testConnection(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    test('maps a real connection failure to a 400', async () => {
      mockReq.params = { providerId: 'p1' };
      providerService.testConnection.mockRejectedValue(
        new Error('Connection test failed: timeout')
      );

      await developerProviderController.testConnection(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getModels', () => {
    test('fetches models via providerService.getAvailableModels, forwarding req.projectContext', async () => {
      mockReq.params = { providerId: 'p1' };
      providerService.getAvailableModels.mockResolvedValue([{ id: 'gpt-4o' }]);

      await developerProviderController.getModels(mockReq, mockRes, next);

      expect(providerService.getAvailableModels).toHaveBeenCalledWith(
        'p1',
        undefined,
        machineContext
      );
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [{ id: 'gpt-4o' }] });
    });

    test('collapses "Unauthorized to access this provider" to a 404, existence-hiding', async () => {
      mockReq.params = { providerId: 'p1' };
      providerService.getAvailableModels.mockRejectedValue(
        new Error('Unauthorized to access this provider')
      );

      await developerProviderController.getModels(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('create', () => {
    test('creates via providerService.createProvider using req.projectContext', async () => {
      mockReq.body = {
        label: 'Support Provider',
        baseURL: 'https://api.example.com',
        apiKey: 'raw-key',
        defaultModel: 'gpt-4o',
      };
      providerService.createProvider.mockResolvedValue({ id: 'p1', label: 'Support Provider' });

      await developerProviderController.create(mockReq, mockRes, next);

      expect(providerService.createProvider).toHaveBeenCalledWith(
        undefined,
        mockReq.body,
        machineContext
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('rejects a ProjectRuntimeContext (ExternalUser) with a 400, no service call (AD-06 §21)', async () => {
      mockReq.projectContext = runtimeContext;

      await developerProviderController.create(mockReq, mockRes, next);

      expect(providerService.createProvider).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    test('returns the Provider using the :providerId param and req.projectContext', async () => {
      mockReq.params = { providerId: 'p1' };
      providerService.getProviderById.mockResolvedValue({ id: 'p1' });

      await developerProviderController.getOne(mockReq, mockRes, next);

      expect(providerService.getProviderById).toHaveBeenCalledWith('p1', undefined, machineContext);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: { id: 'p1' } });
    });

    test('collapses "Provider not found" to a 404, existence-hiding', async () => {
      mockReq.params = { providerId: 'p1' };
      providerService.getProviderById.mockRejectedValue(new Error('Provider not found'));

      await developerProviderController.getOne(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    test('updates via providerService.updateProvider, forwarding req.projectContext', async () => {
      mockReq.params = { providerId: 'p1' };
      mockReq.body = { label: 'Renamed' };
      providerService.updateProvider.mockResolvedValue({ id: 'p1' });

      await developerProviderController.update(mockReq, mockRes, next);

      expect(providerService.updateProvider).toHaveBeenCalledWith(
        undefined,
        'p1',
        { label: 'Renamed' },
        machineContext
      );
    });

    test('collapses "Unauthorized to update this provider" to a 404, existence-hiding', async () => {
      mockReq.params = { providerId: 'p1' };
      providerService.updateProvider.mockRejectedValue(
        new Error('Unauthorized to update this provider')
      );

      await developerProviderController.update(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    test('deletes via providerService.deleteProvider, forwarding req.projectContext', async () => {
      mockReq.params = { providerId: 'p1' };
      providerService.deleteProvider.mockResolvedValue(true);

      await developerProviderController.remove(mockReq, mockRes, next);

      expect(providerService.deleteProvider).toHaveBeenCalledWith(undefined, 'p1', machineContext);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Provider deleted successfully',
      });
    });

    test('collapses "Unauthorized to delete this provider" to a 404, existence-hiding', async () => {
      mockReq.params = { providerId: 'p1' };
      providerService.deleteProvider.mockRejectedValue(
        new Error('Unauthorized to delete this provider')
      );

      await developerProviderController.remove(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
