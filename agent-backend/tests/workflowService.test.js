import { jest } from '@jest/globals';

const mockWorkflowRepo = {
  create: jest.fn(),
  findByProjectAndId: jest.fn(),
  findById: jest.fn(),
  listByProject: jest.fn(),
  countByProject: jest.fn(),
  update: jest.fn(),
  updateDraft: jest.fn(),
  deleteByProjectAndId: jest.fn(),
  incrementPublishedVersion: jest.fn(),
  checkAndIncrementActiveRuns: jest.fn(),
  decrementActiveRuns: jest.fn(),
};

const mockWorkflowVersionRepo = {
  create: jest.fn(),
  listByWorkflow: jest.fn(),
  countByWorkflow: jest.fn(),
  findByWorkflowAndVersion: jest.fn(),
};

const mockWorkflowRunRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByProjectAndId: jest.fn(),
  listByWorkflow: jest.fn(),
  countByWorkflow: jest.fn(),
  updateStatus: jest.fn(),
  recordNodeRunStart: jest.fn(),
  recordNodeRunCompletion: jest.fn(),
};

const mockUsageService = {
  checkPreflightBalance: jest.fn(),
  recordAndDeductUsage: jest.fn(),
};

const mockAgentRepo = {
  findById: jest.fn(),
};

const mockCheckpointService = {
  checkpointer: {
    getTuple: jest.fn(),
  },
};

jest.unstable_mockModule('../src/modules/developer/workflows/workflow.repository.js', () => ({
  default: mockWorkflowRepo,
}));

jest.unstable_mockModule(
  '../src/modules/developer/workflows/workflowVersion.repository.js',
  () => ({
    default: mockWorkflowVersionRepo,
  })
);

jest.unstable_mockModule('../src/modules/developer/workflows/workflowRun.repository.js', () => ({
  default: mockWorkflowRunRepo,
}));

jest.unstable_mockModule('../src/modules/developer/workflows/workflowUsage.service.js', () => ({
  default: mockUsageService,
}));

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: mockAgentRepo,
}));

jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: mockCheckpointService,
}));

const workflowService = (await import('../src/modules/developer/workflows/workflow.service.js'))
  .default;

describe('Workflow Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createWorkflow & validation', () => {
    test('creates workflow with default draft when no draft provided', async () => {
      mockWorkflowRepo.create.mockImplementation(async (data) => ({
        _id: 'wf_new',
        ...data,
      }));

      const result = await workflowService.createWorkflow('proj_1', { name: 'My Flow' }, 'usr_1');

      expect(mockWorkflowRepo.create).toHaveBeenCalled();
      expect(result._id).toBe('wf_new');
      expect(result.name).toBe('My Flow');
      expect(result.draft.nodes.length).toBe(2);
      expect(result.draft.nodes[0].type).toBe('trigger');
      expect(result.draft.nodes[1].type).toBe('output');
    });

    test('rejects workflow creation if cycle is detected in draft', async () => {
      const cyclicalDraft = {
        nodes: [
          { id: 'n1', type: 'agentStep', data: { label: 'Node 1' } },
          { id: 'n2', type: 'agentStep', data: { label: 'Node 2' } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n2', target: 'n1' },
        ],
      };

      await expect(
        workflowService.createWorkflow(
          'proj_1',
          { name: 'Bad Flow', draft: cyclicalDraft },
          'usr_1'
        )
      ).rejects.toThrow('Cycles are not supported in v1');
      expect(mockWorkflowRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('publishWorkflow & agent snapshotting', () => {
    test('snapshots referenced agents and increments version on publish', async () => {
      const workflow = {
        _id: 'wf_123',
        publishedVersion: 1,
        draft: {
          nodes: [
            { id: 't1', type: 'trigger', data: { label: 'Start' } },
            {
              id: 'a1',
              type: 'agentStep',
              data: { config: { agentId: 'agent_target' }, label: 'Agent' },
            },
            { id: 'o1', type: 'output', data: { label: 'End' } },
          ],
          edges: [
            { id: 'e1', source: 't1', target: 'a1' },
            { id: 'e2', source: 'a1', target: 'o1' },
          ],
        },
      };

      mockWorkflowRepo.findByProjectAndId.mockResolvedValue(workflow);
      mockAgentRepo.findById.mockResolvedValue({
        _id: 'agent_target',
        modelName: 'gpt-4o',
        systemPrompt: 'You are helpful.',
        tools: ['web_search', { name: 'calculator' }],
      });
      mockWorkflowVersionRepo.create.mockResolvedValue({
        version: 2,
        workflowId: 'wf_123',
      });

      const versionDoc = await workflowService.publishWorkflow('proj_1', 'wf_123', 'usr_admin', {
        principalType: 'ProjectAdmin',
      });

      expect(versionDoc.version).toBe(2);
      expect(mockAgentRepo.findById).toHaveBeenCalledWith('agent_target');
      expect(mockWorkflowVersionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
          workflowId: 'wf_123',
          agentSnapshots: expect.any(Map),
        })
      );
      expect(mockWorkflowRepo.incrementPublishedVersion).toHaveBeenCalledWith('wf_123');
    });

    test('rejects publish if draft is empty', async () => {
      const workflow = {
        _id: 'wf_empty',
        draft: { nodes: [] },
      };
      mockWorkflowRepo.findByProjectAndId.mockResolvedValue(workflow);

      await expect(
        workflowService.publishWorkflow('proj_1', 'wf_empty', 'usr_admin', {
          principalType: 'ProjectAdmin',
        })
      ).rejects.toThrow('Cannot publish an empty workflow draft');
    });
  });

  describe('runWorkflow & concurrency limits', () => {
    test('enforces concurrency limit and throws 429 when max runs reached', async () => {
      const workflow = {
        _id: 'wf_busy',
        publishedVersion: 1,
        draft: {
          nodes: [
            { id: 't1', type: 'trigger', data: {} },
            { id: 'o1', type: 'output', data: {} },
          ],
        },
      };
      mockWorkflowRepo.findByProjectAndId.mockResolvedValue(workflow);
      mockUsageService.checkPreflightBalance.mockResolvedValue({ allowed: true });
      // Atomically checkAndIncrementActiveRuns returns null when limit exceeded
      mockWorkflowRepo.checkAndIncrementActiveRuns.mockResolvedValue(null);

      await expect(
        workflowService.runWorkflow({
          workflowId: 'wf_busy',
          projectId: 'proj_1',
          userId: 'usr_1',
          context: { principalType: 'ProjectAdmin' },
        })
      ).rejects.toThrow('Concurrency limit reached for this workflow');

      expect(mockWorkflowRepo.checkAndIncrementActiveRuns).toHaveBeenCalledWith('wf_busy', 5);
      expect(mockWorkflowRunRepo.create).not.toHaveBeenCalled();
    });

    test('decrements active runs and rejects if required node configuration is incomplete', async () => {
      const workflow = {
        _id: 'wf_incomplete',
        publishedVersion: 0,
        draft: {
          nodes: [
            { id: 't1', type: 'trigger', data: {} },
            // AgentStep without agentId is incomplete
            { id: 'a1', type: 'agentStep', data: { config: {} } },
            { id: 'o1', type: 'output', data: {} },
          ],
        },
      };
      mockWorkflowRepo.findByProjectAndId.mockResolvedValue(workflow);
      mockUsageService.checkPreflightBalance.mockResolvedValue({ allowed: true });
      mockWorkflowRepo.checkAndIncrementActiveRuns.mockResolvedValue({ activeRuns: 1 });

      await expect(
        workflowService.runWorkflow({
          workflowId: 'wf_incomplete',
          projectId: 'proj_1',
          userId: 'usr_1',
          context: { principalType: 'ProjectAdmin' },
        })
      ).rejects.toThrow();

      // Decrement slot must be called to prevent resource leak
      expect(mockWorkflowRepo.decrementActiveRuns).toHaveBeenCalledWith('wf_incomplete');
      expect(mockWorkflowRunRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('resumeRun & resumeOrphanRun', () => {
    test('serves persisted snapshot when driver is not in memory', async () => {
      const run = {
        _id: 'run_past_1',
        status: 'completed',
        nodeRuns: [],
        output: { result: 'All steps finished' },
        usage: { creditsDeducted: 1 },
      };
      mockWorkflowRunRepo.findByProjectAndId.mockResolvedValue(run);

      const written = [];
      const mockRes = {
        setHeader: jest.fn(),
        write: (data) => written.push(data),
        end: jest.fn(),
      };

      await workflowService.resumeRun('proj_1', 'run_past_1', mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream; charset=utf-8'
      );
      expect(written.length).toBe(1);
      const parsed = JSON.parse(written[0].replace('data: ', '').trim());
      expect(parsed.name).toBe('workflow_run_snapshot');
      expect(parsed.value.status).toBe('completed');
      expect(mockRes.end).toHaveBeenCalled();
    });

    test('recovers orphan run from MongoDB checkpoint tuple', async () => {
      const orphanRun = {
        _id: 'run_orphan_1',
        status: 'running',
        workflowId: 'wf_existing',
        workflowVersion: 1,
        projectId: 'proj_1',
        threadId: 'th_orphan_1',
      };
      mockWorkflowRunRepo.findById.mockResolvedValue(orphanRun);
      mockWorkflowRepo.findById.mockResolvedValue({
        _id: 'wf_existing',
        draft: { nodes: [] },
      });
      mockWorkflowVersionRepo.findByWorkflowAndVersion.mockResolvedValue({
        version: 1,
        definition: {
          nodes: [
            { id: 't1', type: 'trigger', data: {} },
            { id: 'o1', type: 'output', data: {} },
          ],
          edges: [{ id: 'e1', source: 't1', target: 'o1' }],
        },
      });
      mockCheckpointService.checkpointer.getTuple.mockResolvedValue({
        checkpoint: { id: 'cp_1' },
      });

      // Spy on _executeWorkflowGraph
      const spyExecute = jest
        .spyOn(workflowService, '_executeWorkflowGraph')
        .mockResolvedValue(undefined);

      await workflowService.resumeOrphanRun('run_orphan_1');

      expect(spyExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run_orphan_1',
          threadId: 'th_orphan_1',
          resumeFromCheckpoint: true,
        })
      );

      spyExecute.mockRestore();
    });
  });
});
