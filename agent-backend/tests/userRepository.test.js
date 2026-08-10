import { jest } from '@jest/globals';
import userRepository from '../src/modules/users/user.repository.js';
import User from '../src/modules/users/user.model.js';

describe('User Repository — searchByEmailPrefix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('searches active users by a case-insensitive email prefix, selecting only name+email', async () => {
    const matches = [{ id: 'u1', name: 'Sabik', email: 'sabik@beyond.campus' }];
    jest.spyOn(User, 'find').mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(matches),
      }),
    });

    const result = await userRepository.searchByEmailPrefix('SABIK@');

    expect(User.find).toHaveBeenCalledWith({
      email: { $regex: '^sabik@', $options: 'i' },
      isActive: true,
    });
    // The .select(...) call is chained off the find() result.
    expect(result).toEqual(matches);
  });

  test('escapes regex-special characters in the query', async () => {
    const chain = {
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    };
    jest.spyOn(User, 'find').mockReturnValue(chain);

    await userRepository.searchByEmailPrefix('a+b.c@x');

    expect(User.find).toHaveBeenCalledWith({
      email: { $regex: '^a\\+b\\.c@x', $options: 'i' },
      isActive: true,
    });
  });

  test('returns an empty array for an empty or whitespace query without touching the model', async () => {
    const findSpy = jest.spyOn(User, 'find');

    expect(await userRepository.searchByEmailPrefix('')).toEqual([]);
    expect(await userRepository.searchByEmailPrefix('   ')).toEqual([]);

    expect(findSpy).not.toHaveBeenCalled();
  });

  test('caps results at the limit (default 8)', async () => {
    const chain = {
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    };
    jest.spyOn(User, 'find').mockReturnValue(chain);

    await userRepository.searchByEmailPrefix('a@b');

    expect(chain.select).toHaveBeenCalledWith('name email');
    expect(chain.select().limit).toHaveBeenCalledWith(8);
  });
});
