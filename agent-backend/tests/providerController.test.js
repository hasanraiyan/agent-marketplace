import { jest } from '@jest/globals';

// Mock the service layer
jest.unstable_mockModule('../src/services/provider.service.js', () => ({
  default: {
    getUserProviders: jest.fn(),
    createProvider: jest.fn(),
    updateProvider: jest.fn(),
    deleteProvider: jest.fn(),
    testConnection: jest.fn(),
  },
}));

// Mock the validator to pass validation automatically for controller testing
jest.unstable_mockModule('../src/validators/provider.validator.js', () => ({
  createProviderSchema: {
    parse: jest.fn().mockImplementation((data) => data),
  },
  updateProviderSchema: {
    parse: jest.fn().mockImplementation((data) => data),
  },
  testConnectionSchema: {
    parse: jest.fn().mockImplementation((data) => data),
  },
}));

const providerService = (await import('../src/services/provider.service.js')).default;
const providerController = (await import('../src/controllers/provider.controller.js')).default;

describe('Provider Controller', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: { id: 'user123' },
      body: {},
      params: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('getAll', () => {
    test('should return all providers for user', async () => {
      const mockProviders = [{ id: 'prov1' }];
      providerService.getUserProviders.mockResolvedValue(mockProviders);

      await providerController.getAll(mockReq, mockRes, mockNext);

      expect(providerService.getUserProviders).toHaveBeenCalledWith('user123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockProviders,
      });
    });

    test('should pass errors to next', async () => {
      const err = new Error('DB Error');
      providerService.getUserProviders.mockRejectedValue(err);

      await providerController.getAll(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  describe('create', () => {
    test('should return 201 and created provider', async () => {
      const providerData = { label: 'New' };
      mockReq.body = providerData;
      providerService.createProvider.mockResolvedValue({ id: 'prov1', ...providerData });

      await providerController.create(mockReq, mockRes, mockNext);

      expect(providerService.createProvider).toHaveBeenCalledWith('user123', providerData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 'prov1', ...providerData },
      });
    });
  });

  describe('update', () => {
    test('should updated provider successfully', async () => {
      const updateData = { label: 'Updated' };
      mockReq.body = updateData;
      mockReq.params = { id: 'prov1' };
      providerService.updateProvider.mockResolvedValue({ id: 'prov1', ...updateData });

      await providerController.update(mockReq, mockRes, mockNext);

      expect(providerService.updateProvider).toHaveBeenCalledWith('user123', 'prov1', updateData);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 'prov1', ...updateData },
      });
    });
  });

  describe('remove', () => {
    test('should delete provider successfully', async () => {
      mockReq.params = { id: 'prov1' };
      providerService.deleteProvider.mockResolvedValue(true);

      await providerController.remove(mockReq, mockRes, mockNext);

      expect(providerService.deleteProvider).toHaveBeenCalledWith('user123', 'prov1');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Provider deleted successfully',
      });
    });
  });

  describe('testConnection', () => {
    test('should return test connection result', async () => {
      mockReq.params = { id: 'prov1' };
      providerService.testConnection.mockResolvedValue({ success: true, message: 'OK' });

      await providerController.testConnection(mockReq, mockRes, mockNext);

      expect(providerService.testConnection).toHaveBeenCalledWith('prov1', 'user123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { success: true, message: 'OK' },
      });
    });

    test('should return 400 on explicit test failure instead of crashing', async () => {
      mockReq.params = { id: 'prov1' };
      providerService.testConnection.mockRejectedValue(new Error('Invalid API Key'));

      await providerController.testConnection(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid API Key',
      });
    });
  });
});
