import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/audit/auditLog.service.js', () => ({
  default: {
    listForDomain: jest.fn(),
    countForDomain: jest.fn(),
  },
}));

const auditLogService = (await import('../src/modules/audit/auditLog.service.js')).default;
const developerAuditLogController = (
  await import('../src/modules/developer/developerAuditLog.controller.js')
).default;

describe('Developer AuditLog Controller (Feature 6)', () => {
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
    mockReq = { projectContext: machineContext, query: {} };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('list', () => {
    test('lists via auditLogService for a ProjectMachineContext, wrapped in a pagination envelope', async () => {
      auditLogService.listForDomain.mockResolvedValue([{ eventType: 'credential.created' }]);
      auditLogService.countForDomain.mockResolvedValue(1);

      await developerAuditLogController.list(mockReq, mockRes, next);

      expect(auditLogService.listForDomain).toHaveBeenCalledWith(
        'project-1',
        { eventType: undefined },
        { page: 1, limit: 20 }
      );
      expect(auditLogService.countForDomain).toHaveBeenCalledWith('project-1', {
        eventType: undefined,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          items: [{ eventType: 'credential.created' }],
          pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        },
      });
    });

    test('forwards page/limit/eventType query params', async () => {
      mockReq.query = { page: '2', limit: '5', eventType: 'credential.revoked' };
      auditLogService.listForDomain.mockResolvedValue([]);
      auditLogService.countForDomain.mockResolvedValue(0);

      await developerAuditLogController.list(mockReq, mockRes, next);

      expect(auditLogService.listForDomain).toHaveBeenCalledWith(
        'project-1',
        { eventType: 'credential.revoked' },
        { page: 2, limit: 5 }
      );
    });

    test('a ProjectRuntimeContext gets a silent empty envelope, never calling the service', async () => {
      mockReq.projectContext = runtimeContext;

      await developerAuditLogController.list(mockReq, mockRes, next);

      expect(auditLogService.listForDomain).not.toHaveBeenCalled();
      expect(auditLogService.countForDomain).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { items: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } },
      });
    });

    test('passes a thrown error to next()', async () => {
      const err = new Error('boom');
      auditLogService.listForDomain.mockRejectedValue(err);
      auditLogService.countForDomain.mockResolvedValue(0);

      await developerAuditLogController.list(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
