import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/projects/projectMembership.repository.js', () => ({
  default: {
    findByProjectAndUser: jest.fn(),
  },
}));

const projectMembershipRepository = (
  await import('../src/modules/projects/projectMembership.repository.js')
).default;
const { default: projectAdminAuthMiddleware } =
  await import('../src/modules/auth/projectAdminAuth.middleware.js');

describe('projectAdminAuthMiddleware', () => {
  const projectId = '507f1f77bcf86cd799439099';
  const personaUserId = '507f1f77bcf86cd799439011';

  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { params: { projectId }, user: { _id: personaUserId } };
    mockRes = {};
    next = jest.fn();
  });

  test('attaches a ProjectAdminContext when the caller has a membership', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
      project: projectId,
      personaUserId,
      role: 'Admin',
    });

    await projectAdminAuthMiddleware(mockReq, mockRes, next);

    expect(mockReq.projectAdminContext).toEqual({
      domain: projectId,
      principalType: 'ProjectAdmin',
      personaUserId,
      membershipRole: 'Admin',
    });
    expect(next).toHaveBeenCalledWith();
  });

  test('rejects with 404 (not 403) when the caller has no membership — existence-hiding (AD-07 §29)', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);

    await projectAdminAuthMiddleware(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(mockReq.projectAdminContext).toBeUndefined();
  });

  test('rejects with 404 (not 500) on a malformed projectId, same as a real mismatch', async () => {
    projectMembershipRepository.findByProjectAndUser.mockRejectedValue(
      new Error('Cast to ObjectId failed')
    );

    await projectAdminAuthMiddleware(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  test('rejects with 401 when req.user is missing', async () => {
    mockReq.user = undefined;

    await projectAdminAuthMiddleware(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(projectMembershipRepository.findByProjectAndUser).not.toHaveBeenCalled();
  });
});
