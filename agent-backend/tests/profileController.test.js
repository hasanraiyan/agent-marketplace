import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/users/user.repository.js', () => ({
  default: {
    findByIdForProfile: jest.fn(),
    update: jest.fn(),
    addOnboardingSeenSection: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/users/user.service.js', () => ({
  default: {
    deleteUser: jest.fn(),
  },
}));

const userRepository = (await import('../src/modules/users/user.repository.js')).default;
const profileController = (await import('../src/modules/users/profile.controller.js')).default;

describe('Profile Controller — markOnboardingSeen', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: { id: 'user123' },
      body: { section: 'dashboard' },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();
  });

  test('marks the given section seen and returns the updated list', async () => {
    userRepository.addOnboardingSeenSection.mockResolvedValue({
      id: 'user123',
      onboardingSeen: ['dashboard'],
    });

    await profileController.markOnboardingSeen(mockReq, mockRes, mockNext);

    expect(userRepository.addOnboardingSeenSection).toHaveBeenCalledWith('user123', 'dashboard');
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { onboardingSeen: ['dashboard'] },
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('forwards repository errors to next()', async () => {
    const error = new Error('not found');
    userRepository.addOnboardingSeenSection.mockRejectedValue(error);

    await profileController.markOnboardingSeen(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockRes.json).not.toHaveBeenCalled();
  });
});

describe('Profile Controller — getProfile includes onboardingSeen', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { user: { id: 'user123' } };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    mockNext = jest.fn();
  });

  test('defaults onboardingSeen to an empty array when absent on the user doc', async () => {
    userRepository.findByIdForProfile.mockResolvedValue({
      id: 'user123',
      name: 'Test',
      email: 't@example.com',
    });

    await profileController.getProfile(mockReq, mockRes, mockNext);

    const payload = mockRes.json.mock.calls[0][0];
    expect(payload.data.onboardingSeen).toEqual([]);
  });

  test('passes through a populated onboardingSeen array', async () => {
    userRepository.findByIdForProfile.mockResolvedValue({
      id: 'user123',
      name: 'Test',
      email: 't@example.com',
      onboardingSeen: ['dashboard', 'studio'],
    });

    await profileController.getProfile(mockReq, mockRes, mockNext);

    const payload = mockRes.json.mock.calls[0][0];
    expect(payload.data.onboardingSeen).toEqual(['dashboard', 'studio']);
  });
});
