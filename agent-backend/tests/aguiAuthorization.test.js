import { jest } from '@jest/globals';
import NotFoundError from '../src/utils/errors/NotFoundError.js';

// Mock dependencies
jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
  default: {
    findById: jest.fn(),
    touchLastMessageAt: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.factory.js', () => ({
  default: {
    buildAgent: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: {
    checkpointer: {},
    _autoTitleThread: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agui/aguiTranslator.js', () => ({
  translateLangGraphStream: jest.fn(),
  emitTextNotice: jest.fn(),
  formatRuntimeError: jest.fn((err) => err.message),
  buildResumeValue: jest.fn(),
  describeInterrupt: jest.fn(),
}));

jest.unstable_mockModule('../src/modules/auth/auth.middleware.js', () => ({
  default: (req, res, next) => {
    req.user = { _id: 'user_consumer' };
    next();
  },
}));

const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const { default: agentService, personaExecutionContext } =
  await import('../src/modules/agents/agent.service.js');
const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
const aguiController = (await import('../src/modules/agui/agui.controller.js')).default;

describe('AG-UI Execution Authorization & Policy Hardening', () => {
  const ownerId = 'user_owner';
  const consumerId = 'user_consumer';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canUserExecuteAgent Access Policy Matrix', () => {
    test('Public + active + not deleted: allowed for both owner and non-owner', () => {
      const agent = { ownerId, visibility: 'public', isActive: true, deletedAt: null };
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(ownerId))).toBe(true);
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(consumerId))).toBe(
        true
      );
    });

    test('Unlisted + active + not deleted: allowed for both owner and non-owner', () => {
      const agent = { ownerId, visibility: 'unlisted', isActive: true, deletedAt: null };
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(ownerId))).toBe(true);
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(consumerId))).toBe(
        true
      );
    });

    test('Private + active + not deleted: allowed for owner, denied for non-owner', () => {
      const agent = { ownerId, visibility: 'private', isActive: true, deletedAt: null };
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(ownerId))).toBe(true);
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(consumerId))).toBe(
        false
      );
    });

    test('Inactive (isActive: false, deletedAt: null): allowed for owner (Studio testing), denied for non-owner', () => {
      const agent = { ownerId, visibility: 'public', isActive: false, deletedAt: null };
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(ownerId))).toBe(true);
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(consumerId))).toBe(
        false
      );
    });

    test('Soft-deleted (deletedAt set): denied for both owner and non-owner', () => {
      const agent = {
        ownerId,
        visibility: 'public',
        isActive: false,
        deletedAt: new Date('2026-01-01'),
      };
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(ownerId))).toBe(false);
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(consumerId))).toBe(
        false
      );
    });

    test('Virtual system agents (e.g. Architect agent): allowed for any user', () => {
      const virtualAgent = { _id: '000000000000000000000000', isVirtual: true };
      expect(
        agentService.canUserExecuteAgent(virtualAgent, personaExecutionContext(consumerId))
      ).toBe(true);
    });

    test('Null or undefined agent: denied', () => {
      expect(agentService.canUserExecuteAgent(null, personaExecutionContext(consumerId))).toBe(
        false
      );
      expect(agentService.canUserExecuteAgent(undefined, personaExecutionContext(consumerId))).toBe(
        false
      );
    });

    test('denies access — not-found, not forbidden — when the agent Domain and context Domain differ, even for the owner (AD-04, blueprint §12)', () => {
      const agent = {
        ownerId,
        visibility: 'private',
        isActive: true,
        deletedAt: null,
        domain: 'some-other-project-id',
      };
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(ownerId))).toBe(false);
    });
  });

  describe('AG-UI Controller Execution Boundary', () => {
    let mockReq;
    let mockRes;
    let next;

    beforeEach(() => {
      mockReq = {
        method: 'POST',
        aguiContext: {
          userId: consumerId,
          agentId: 'agent_private_1',
          langGraphThreadId: 'agui-agent_private_1-user_consumer',
        },
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }));
        },
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        write: jest.fn(),
        end: jest.fn(),
        flushHeaders: jest.fn(),
        on: jest.fn(),
      };

      next = jest.fn();
    });

    test('rejects execution of non-owner private agent BEFORE setting SSE headers', async () => {
      const privateAgent = {
        _id: 'agent_private_1',
        ownerId,
        visibility: 'private',
        isActive: true,
        deletedAt: null,
      };
      agentRepository.findById.mockResolvedValue(privateAgent);

      await aguiController.runAgent(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream; charset=utf-8'
      );
    });

    test('rejects execution of inactive agent for non-owner BEFORE setting SSE headers', async () => {
      const inactiveAgent = {
        _id: 'agent_inactive_1',
        ownerId,
        visibility: 'public',
        isActive: false,
        deletedAt: null,
      };
      agentRepository.findById.mockResolvedValue(inactiveAgent);

      mockReq.aguiContext.agentId = 'agent_inactive_1';

      await aguiController.runAgent(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream; charset=utf-8'
      );
    });

    test('rejects execution of soft-deleted agent BEFORE setting SSE headers', async () => {
      const deletedAgent = {
        _id: 'agent_deleted_1',
        ownerId,
        visibility: 'public',
        isActive: false,
        deletedAt: new Date(),
      };
      agentRepository.findById.mockResolvedValue(deletedAgent);

      mockReq.aguiContext.agentId = 'agent_deleted_1';

      await aguiController.runAgent(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream; charset=utf-8'
      );
    });

    test('rejects execution when existing thread ID is supplied for agent that is now private', async () => {
      const updatedPrivateAgent = {
        _id: 'agent_was_public_now_private',
        ownerId,
        visibility: 'private',
        isActive: true,
        deletedAt: null,
      };
      agentRepository.findById.mockResolvedValue(updatedPrivateAgent);

      mockReq.aguiContext = {
        userId: consumerId,
        agentId: 'agent_was_public_now_private',
        threadDbId: 'thread_old_consumer_thread',
        langGraphThreadId: 'uuid-old-thread',
      };

      await aguiController.runAgent(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream; charset=utf-8'
      );
    });

    test('allows execution for owner testing their own inactive agent', async () => {
      const inactiveAgent = {
        _id: 'agent_inactive_owner',
        ownerId,
        visibility: 'public',
        isActive: false,
        deletedAt: null,
      };
      agentRepository.findById.mockResolvedValue(inactiveAgent);
      agentFactory.buildAgent.mockResolvedValue({
        agentInstance: { streamEvents: (async function* () {})() },
        providerConfig: {},
      });

      mockReq.aguiContext = {
        userId: ownerId,
        agentId: 'agent_inactive_owner',
        langGraphThreadId: 'agui-agent_inactive_owner-user_owner',
      };

      await aguiController.runAgent(mockReq, mockRes, next);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream; charset=utf-8'
      );
    });
  });
});
