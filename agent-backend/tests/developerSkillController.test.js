import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/skills/skill.service.js', () => ({
  default: {
    createSkill: jest.fn(),
    getSkillById: jest.fn(),
    updateSkill: jest.fn(),
    deleteSkill: jest.fn(),
    discoverSkills: jest.fn(),
    getSkillUsage: jest.fn(),
  },
}));

const skillService = (await import('../src/modules/skills/skill.service.js')).default;
const developerSkillController = (
  await import('../src/modules/developer/developerSkill.controller.js')
).default;

describe('Developer Skill Controller', () => {
  const machineContext = { domain: 'project-1', principalType: 'ProjectMachine' };

  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { projectContext: machineContext, body: {}, params: {}, query: {} };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('discover', () => {
    test('discovers via skillService.discoverSkills using req.projectContext', async () => {
      mockReq.query = { search: 'support', scope: 'mine' };
      skillService.discoverSkills.mockResolvedValue([{ _id: 's1' }]);

      await developerSkillController.discover(mockReq, mockRes, next);

      expect(skillService.discoverSkills).toHaveBeenCalledWith(
        machineContext,
        { search: 'support', scope: 'mine' },
        { page: 1, limit: 20 }
      );
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [{ _id: 's1' }] });
    });

    test('passes errors to next', async () => {
      const err = new Error('boom');
      skillService.discoverSkills.mockRejectedValue(err);

      await developerSkillController.discover(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('create', () => {
    test('creates via skillService.createSkill using req.projectContext', async () => {
      mockReq.body = { name: 'support-skill' };
      skillService.createSkill.mockResolvedValue({ _id: 's1', name: 'support-skill' });

      await developerSkillController.create(mockReq, mockRes, next);

      expect(skillService.createSkill).toHaveBeenCalledWith(
        undefined,
        { name: 'support-skill' },
        machineContext
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('maps a duplicate-key error to 409', async () => {
      const dupError = new Error('duplicate');
      dupError.code = 11000;
      skillService.createSkill.mockRejectedValue(dupError);

      await developerSkillController.create(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    test('returns the Skill using the :skillId param and req.projectContext', async () => {
      mockReq.params = { skillId: 's1' };
      skillService.getSkillById.mockResolvedValue({ _id: 's1' });

      await developerSkillController.getOne(mockReq, mockRes, next);

      expect(skillService.getSkillById).toHaveBeenCalledWith('s1', undefined, machineContext);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: { _id: 's1' } });
    });

    test('collapses "Skill not found or private" to a 404, existence-hiding', async () => {
      mockReq.params = { skillId: 's1' };
      skillService.getSkillById.mockRejectedValue(new Error('Skill not found or private'));

      await developerSkillController.getOne(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getUsage', () => {
    test('returns usage via skillService.getSkillUsage', async () => {
      mockReq.params = { skillId: 's1' };
      skillService.getSkillUsage.mockResolvedValue({
        agentCount: 1,
        agents: [{ _id: 'a1', name: 'Agent One' }],
      });

      await developerSkillController.getUsage(mockReq, mockRes, next);

      expect(skillService.getSkillUsage).toHaveBeenCalledWith('s1', undefined, machineContext);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { agentCount: 1, agents: [{ _id: 'a1', name: 'Agent One' }] },
      });
    });

    test('collapses "Skill not found or private" to a 404, existence-hiding', async () => {
      mockReq.params = { skillId: 's1' };
      skillService.getSkillUsage.mockRejectedValue(new Error('Skill not found or private'));

      await developerSkillController.getUsage(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    test('updates via skillService.updateSkill, forwarding req.projectContext', async () => {
      mockReq.params = { skillId: 's1' };
      mockReq.body = { description: 'new description here' };
      skillService.updateSkill.mockResolvedValue({ _id: 's1' });

      await developerSkillController.update(mockReq, mockRes, next);

      expect(skillService.updateSkill).toHaveBeenCalledWith(
        's1',
        undefined,
        { description: 'new description here' },
        machineContext
      );
    });

    test('maps a duplicate-key error to 409', async () => {
      mockReq.params = { skillId: 's1' };
      const dupError = new Error('duplicate');
      dupError.code = 11000;
      skillService.updateSkill.mockRejectedValue(dupError);

      await developerSkillController.update(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });
  });

  describe('remove', () => {
    test('deletes via skillService.deleteSkill, forwarding req.projectContext', async () => {
      mockReq.params = { skillId: 's1' };
      skillService.deleteSkill.mockResolvedValue(true);

      await developerSkillController.remove(mockReq, mockRes, next);

      expect(skillService.deleteSkill).toHaveBeenCalledWith('s1', undefined, machineContext);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Skill deleted successfully',
      });
    });
  });
});
