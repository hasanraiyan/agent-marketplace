import { jest } from '@jest/globals';

const mockCreate = jest.fn();

jest.unstable_mockModule('../src/modules/audit/auditLog.model.js', () => ({
  default: { create: mockCreate },
}));

jest.unstable_mockModule('../src/modules/audit/auditLog.repository.js', () => ({
  default: { search: jest.fn(), count: jest.fn() },
}));

jest.unstable_mockModule('../src/utils/index.js', () => ({
  errors: {},
  validators: {},
  formatters: {},
  loggerService: {
    getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    setLogger: jest.fn(),
  },
  constants: {},
}));

const auditLogRepository = (await import('../src/modules/audit/auditLog.repository.js')).default;
const auditLogService = (await import('../src/modules/audit/auditLog.service.js')).default;

describe('AuditLog Service (blueprint Phase 10, PR-51, AD-08 §35)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('record() persists every field, stringifying identity/resource ids', async () => {
    mockCreate.mockResolvedValue({});

    await auditLogService.record({
      eventType: 'project.suspended',
      actorContextType: 'ProjectAdmin',
      actorIdentity: 'user_1',
      targetDomain: 'project_1',
      targetResourceId: 'cred_1',
      metadata: { foo: 'bar' },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      eventType: 'project.suspended',
      actorContextType: 'ProjectAdmin',
      actorIdentity: 'user_1',
      targetDomain: 'project_1',
      targetResourceId: 'cred_1',
      metadata: { foo: 'bar' },
    });
  });

  test('record() defaults targetResourceId to null and metadata to {} when omitted', async () => {
    mockCreate.mockResolvedValue({});

    await auditLogService.record({
      eventType: 'project.created',
      actorContextType: 'PersonaUser',
      actorIdentity: 'user_1',
      targetDomain: 'project_1',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ targetResourceId: null, metadata: {} })
    );
  });

  test('record() never throws when the write fails — fire-and-forget by design', async () => {
    mockCreate.mockRejectedValue(new Error('Mongo down'));

    await expect(
      auditLogService.record({
        eventType: 'project.created',
        actorContextType: 'PersonaUser',
        actorIdentity: 'user_1',
        targetDomain: 'project_1',
      })
    ).resolves.not.toThrow();
  });

  test('record() never throws on a validation-shaped rejection either', async () => {
    mockCreate.mockRejectedValue(new Error('AuditLog validation failed'));

    await expect(
      auditLogService.record({
        eventType: 'project.created',
        actorContextType: 'PersonaUser',
        actorIdentity: null,
        targetDomain: 'project_1',
      })
    ).resolves.not.toThrow();
  });

  describe('listForDomain / countForDomain (Feature 6, audit log read endpoint)', () => {
    test('listForDomain scopes to targetDomain and forwards pagination', async () => {
      auditLogRepository.search.mockResolvedValue([{ eventType: 'project.suspended' }]);

      const result = await auditLogService.listForDomain('project_1', {}, { page: 2, limit: 10 });

      expect(auditLogRepository.search).toHaveBeenCalledWith(
        { targetDomain: 'project_1' },
        { page: 2, limit: 10 }
      );
      expect(result).toEqual([{ eventType: 'project.suspended' }]);
    });

    test('listForDomain adds an eventType filter when provided', async () => {
      auditLogRepository.search.mockResolvedValue([]);

      await auditLogService.listForDomain(
        'project_1',
        { eventType: 'credential.created' },
        { page: 1, limit: 20 }
      );

      expect(auditLogRepository.search).toHaveBeenCalledWith(
        { targetDomain: 'project_1', eventType: 'credential.created' },
        { page: 1, limit: 20 }
      );
    });

    test('countForDomain scopes to targetDomain the same way', async () => {
      auditLogRepository.count.mockResolvedValue(3);

      const total = await auditLogService.countForDomain('project_1', {});

      expect(auditLogRepository.count).toHaveBeenCalledWith({ targetDomain: 'project_1' });
      expect(total).toBe(3);
    });
  });
});
