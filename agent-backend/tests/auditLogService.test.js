import { jest } from '@jest/globals';

const mockCreate = jest.fn();

jest.unstable_mockModule('../src/modules/audit/auditLog.model.js', () => ({
  default: { create: mockCreate },
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
});
