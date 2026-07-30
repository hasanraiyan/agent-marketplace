import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (blueprint Phase 9, PR-29): proves
 * developerSkill.routes.js actually wires developerMachineAuthMiddleware
 * + Zod validation + the controller together.
 */

jest.unstable_mockModule('../src/modules/projects/projectCredential.service.js', () => ({
  default: { verifyCredential: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/projects/project.service.js', () => ({
  default: { getProjectById: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/externalUsers/externalUser.service.js', () => ({
  default: { resolveOrCreate: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/skills/skill.service.js', () => ({
  default: {
    createSkill: jest.fn(),
    getSkillById: jest.fn(),
    updateSkill: jest.fn(),
    deleteSkill: jest.fn(),
  },
}));

const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const skillService = (await import('../src/modules/skills/skill.service.js')).default;
const { default: developerSkillRouter } =
  await import('../src/modules/developer/developerSkill.routes.js');

describe('developerSkill.routes.js — mount integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/developer/skills', developerSkillRouter);
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId: 'cred-1',
      project: 'project-1',
    });
    projectService.getProjectById.mockResolvedValue({ _id: 'project-1', status: 'ACTIVE' });
  });

  test('401s without a Project credential, never reaching the controller', async () => {
    const res = await request(app)
      .post('/api/v1/developer/skills')
      .send({ name: 'test-skill', description: 'A test skill here.', instructions: 'Do it well.' });

    expect(res.status).toBe(401);
    expect(skillService.createSkill).not.toHaveBeenCalled();
  });

  test('400s on an invalid body (name fails the lowercase-hyphen pattern)', async () => {
    const res = await request(app)
      .post('/api/v1/developer/skills')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ name: 'NOT VALID', description: 'A test skill here.', instructions: 'Do it well.' });

    expect(res.status).toBe(400);
    expect(skillService.createSkill).not.toHaveBeenCalled();
  });

  test('creates a Skill for a valid credential + valid body', async () => {
    skillService.createSkill.mockResolvedValue({ _id: 's1', name: 'test-skill' });

    const res = await request(app)
      .post('/api/v1/developer/skills')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ name: 'test-skill', description: 'A test skill here.', instructions: 'Do it well.' });

    expect(res.status).toBe(201);
    expect(skillService.createSkill).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ name: 'test-skill' }),
      expect.objectContaining({ domain: 'project-1', principalType: 'ProjectMachine' })
    );
  });

  test('GET /:skillId reaches the controller and returns the Skill', async () => {
    skillService.getSkillById.mockResolvedValue({ _id: 's1' });

    const res = await request(app)
      .get('/api/v1/developer/skills/s1')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(skillService.getSkillById).toHaveBeenCalledWith('s1', undefined, expect.any(Object));
  });
});
