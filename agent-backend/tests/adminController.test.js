import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/utils/logger/index.js', () => ({
  default: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
    setLogger: jest.fn(),
  },
}));

const mockUserFindById = jest.fn();
const mockUserDelete = jest.fn();
const mockUserFindAll = jest.fn();

jest.unstable_mockModule('../src/repositories/userRepository.js', () => ({
  default: {
    findById: mockUserFindById,
    delete: mockUserDelete,
    findAll: mockUserFindAll,
  },
}));

jest.unstable_mockModule('../src/utils/index.js', () => ({
  errors: {},
  validators: {},
  formatters: {},
  loggerService: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
    setLogger: jest.fn(),
  },
  constants: {},
}));

describe('Admin Controller', () => {
  let req, res, next;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    req = {
      params: {},
      query: {},
      user: { id: '507f1f77bcf86cd799439000', role: 'admin' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('deleteUser', () => {
    test('should permanently delete user when admin', async () => {
      const targetUser = {
        id: '507f1f77bcf86cd799439011',
        name: 'Bad User',
        email: 'bad@example.com',
      };

      mockUserFindById.mockResolvedValue(targetUser);
      mockUserDelete.mockResolvedValue(targetUser);

      req.params = { id: '507f1f77bcf86cd799439011' };

      const { deleteUser } = await import('../src/controllers/admin.controller.js');

      await deleteUser(req, res, next);

      expect(mockUserFindById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockUserDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'User permanently deleted',
          data: expect.objectContaining({
            email: 'bad@example.com',
            name: 'Bad User',
          }),
        })
      );
    });

    test('should return 400 when admin tries to delete own account', async () => {
      req.params = { id: '507f1f77bcf86cd799439000' };

      const { deleteUser } = await import('../src/controllers/admin.controller.js');

      await deleteUser(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Cannot delete your own account via admin endpoint',
        })
      );
      expect(mockUserFindById).not.toHaveBeenCalled();
    });

    test('should call next when findById throws', async () => {
      mockUserFindById.mockRejectedValue(new Error('User not found'));

      req.params = { id: '507f1f77bcf86cd799439011' };

      const { deleteUser } = await import('../src/controllers/admin.controller.js');

      await deleteUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should call next when delete throws', async () => {
      const targetUser = {
        id: '507f1f77bcf86cd799439011',
        name: 'Bad User',
        email: 'bad@example.com',
      };

      mockUserFindById.mockResolvedValue(targetUser);
      mockUserDelete.mockRejectedValue(new Error('DB error'));

      req.params = { id: '507f1f77bcf86cd799439011' };

      const { deleteUser } = await import('../src/controllers/admin.controller.js');

      await deleteUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('listUsers', () => {
    test('should return paginated users', async () => {
      const mockUsers = [
        {
          id: '507f1f77bcf86cd799439011',
          name: 'Alice',
          email: 'alice@example.com',
          role: 'normal',
          isActive: true,
          emailVerified: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      mockUserFindAll.mockResolvedValue({
        users: mockUsers,
        pagination: { page: 1, limit: 20, total: 1, pages: 1, hasNext: false, hasPrev: false },
      });

      req.query = { page: '1', limit: '20' };

      const { listUsers } = await import('../src/controllers/admin.controller.js');

      await listUsers(req, res, next);

      expect(mockUserFindAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        filter: {},
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            users: expect.arrayContaining([
              expect.objectContaining({
                id: '507f1f77bcf86cd799439011',
                name: 'Alice',
                email: 'alice@example.com',
              }),
            ]),
            pagination: expect.any(Object),
          }),
        })
      );
    });

    test('should filter by isActive when query param provided', async () => {
      mockUserFindAll.mockResolvedValue({
        users: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0, hasNext: false, hasPrev: false },
      });

      req.query = { isActive: 'false' };

      const { listUsers } = await import('../src/controllers/admin.controller.js');

      await listUsers(req, res, next);

      expect(mockUserFindAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        filter: { isActive: false },
      });
    });

    test('should use default pagination when not provided', async () => {
      mockUserFindAll.mockResolvedValue({
        users: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0, hasNext: false, hasPrev: false },
      });

      const { listUsers } = await import('../src/controllers/admin.controller.js');

      await listUsers(req, res, next);

      expect(mockUserFindAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        filter: {},
      });
    });

    test('should call next when findAll throws', async () => {
      mockUserFindAll.mockRejectedValue(new Error('DB error'));

      const { listUsers } = await import('../src/controllers/admin.controller.js');

      await listUsers(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
