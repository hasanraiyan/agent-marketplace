import { jest } from '@jest/globals';

const developerController = (await import('../src/modules/developer/developer.controller.js'))
  .default;

describe('Developer Controller', () => {
  test('whoami echoes back exactly req.projectContext, nothing more', async () => {
    const projectContext = {
      domain: 'project_1',
      principalType: 'ProjectMachine',
      credentialId: 'cred_1',
    };
    const mockReq = { projectContext };
    const mockRes = { json: jest.fn() };

    await developerController.whoami(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: projectContext });
  });
});
