import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/projects/projectSecret.repository.js', () => ({
  default: {
    findById: jest.fn(),
    findByProjectAndId: jest.fn(),
    touchLastUsedAt: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.unstable_mockModule('../src/modules/restApiTools/restApiTool.repository.js', () => ({
  default: {
    countUsingSecret: jest.fn(),
    findUsingSecret: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  default: {
    encrypt: jest.fn((v) => `enc:${v}`),
    decrypt: jest.fn((v) => String(v).replace(/^enc:/, '')),
  },
}));

jest.unstable_mockModule('../src/modules/audit/auditLog.service.js', () => ({
  default: { log: jest.fn() },
}));

const projectSecretRepository = (await import('../src/modules/projects/projectSecret.repository.js'))
  .default;
const NotFoundError = (await import('../src/utils/errors/NotFoundError.js')).default;
const projectSecretService = (await import('../src/modules/projects/projectSecret.service.js')).default;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('projectSecretService.resolvePlaintext', () => {
  it('throws a clean NotFoundError for a malformed (non-ObjectId) secretId, never an uncaught CastError', async () => {
    await expect(projectSecretService.resolvePlaintext('skilify-tools')).rejects.toThrow(
      NotFoundError
    );
    // The repository (and Mongoose's own casting) must never even be reached.
    expect(projectSecretRepository.findById).not.toHaveBeenCalled();
  });

  it('resolves the decrypted value for a real, existing secret id', async () => {
    const validId = '507f1f77bcf86cd799439011';
    projectSecretRepository.findById.mockResolvedValue({
      _id: validId,
      valueEncrypted: 'enc:secret123',
    });

    const value = await projectSecretService.resolvePlaintext(validId);

    expect(value).toBe('secret123');
    expect(projectSecretRepository.findById).toHaveBeenCalledWith(validId);
  });

  it('throws NotFoundError for a well-formed but nonexistent secret id', async () => {
    const validId = '507f1f77bcf86cd799439011';
    projectSecretRepository.findById.mockResolvedValue(null);

    await expect(projectSecretService.resolvePlaintext(validId)).rejects.toThrow(NotFoundError);
  });
});

describe('projectSecretService.getSecretById', () => {
  it('throws a clean NotFoundError for a malformed (non-ObjectId) id, never an uncaught CastError', async () => {
    await expect(
      projectSecretService.getSecretById({ domain: 'proj-1' }, 'skilify-tools')
    ).rejects.toThrow(NotFoundError);
    expect(projectSecretRepository.findByProjectAndId).not.toHaveBeenCalled();
  });
});
