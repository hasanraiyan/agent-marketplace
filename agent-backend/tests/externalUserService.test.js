import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/externalUsers/externalUser.repository.js', () => ({
  default: {
    resolveOrCreate: jest.fn(),
    findByProjectAndExternalUserId: jest.fn(),
  },
}));

const externalUserRepository = (
  await import('../src/modules/externalUsers/externalUser.repository.js')
).default;
const externalUserService = (await import('../src/modules/externalUsers/externalUser.service.js'))
  .default;

describe('ExternalUser Service', () => {
  const beyondCampusId = '507f1f77bcf86cd799439099';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveOrCreate', () => {
    test('delegates to the repository for a valid (project, externalUserId) pair', async () => {
      const resolved = { _id: 'x', project: beyondCampusId, externalUserId: 'rahul' };
      externalUserRepository.resolveOrCreate.mockResolvedValue(resolved);

      const result = await externalUserService.resolveOrCreate(beyondCampusId, 'rahul');

      expect(externalUserRepository.resolveOrCreate).toHaveBeenCalledWith(
        beyondCampusId,
        'rahul',
        {}
      );
      expect(result).toEqual(resolved);
    });

    test('passes optional metadata through unchanged', async () => {
      externalUserRepository.resolveOrCreate.mockResolvedValue({});

      await externalUserService.resolveOrCreate(beyondCampusId, 'sabik', {
        displayName: 'Sabik',
      });

      expect(externalUserRepository.resolveOrCreate).toHaveBeenCalledWith(beyondCampusId, 'sabik', {
        displayName: 'Sabik',
      });
    });

    test("is idempotent from the caller's perspective — repeated calls for the same pair resolve to the same record", async () => {
      const resolved = { _id: 'stable-id', project: beyondCampusId, externalUserId: 'rahul' };
      externalUserRepository.resolveOrCreate.mockResolvedValue(resolved);

      const first = await externalUserService.resolveOrCreate(beyondCampusId, 'rahul');
      const second = await externalUserService.resolveOrCreate(beyondCampusId, 'rahul');

      expect(first._id).toBe('stable-id');
      expect(second._id).toBe('stable-id');
      expect(externalUserRepository.resolveOrCreate).toHaveBeenCalledTimes(2);
    });

    test.each([
      [null, 'rahul', /project \(Domain\) is required/],
      [undefined, 'rahul', /project \(Domain\) is required/],
      [beyondCampusId, null, /non-empty externalUserId is required/],
      [beyondCampusId, undefined, /non-empty externalUserId is required/],
      [beyondCampusId, '', /non-empty externalUserId is required/],
    ])(
      'fails closed for invalid input: project=%p, externalUserId=%p',
      async (project, id, msg) => {
        await expect(externalUserService.resolveOrCreate(project, id)).rejects.toThrow(msg);
        expect(externalUserRepository.resolveOrCreate).not.toHaveBeenCalled();
      }
    );
  });

  describe('findByProjectAndExternalUserId', () => {
    test('delegates to the repository', async () => {
      const doc = { project: beyondCampusId, externalUserId: 'rahul' };
      externalUserRepository.findByProjectAndExternalUserId.mockResolvedValue(doc);

      const result = await externalUserService.findByProjectAndExternalUserId(
        beyondCampusId,
        'rahul'
      );

      expect(externalUserRepository.findByProjectAndExternalUserId).toHaveBeenCalledWith(
        beyondCampusId,
        'rahul'
      );
      expect(result).toEqual(doc);
    });
  });
});
