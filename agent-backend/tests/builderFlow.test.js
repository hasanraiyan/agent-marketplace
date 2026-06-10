import { jest } from '@jest/globals';
import { EventType } from '@ag-ui/core';
import agentService from '../src/services/agent.service.js';
import providerRepository from '../src/repositories/providerRepository.js';
import { upsertAgentTool } from '../src/tools/builder.tools.js';
import {
  translateLangGraphStream,
  describeInterrupt,
  buildInterruptNotice,
  buildResumeValue,
} from '../src/utils/aguiTranslator.js';
import { askClarificationTool } from '../src/tools/clarification.tool.js';

describe('upsert_agent result contract', () => {
  const userId = 'user-123';
  const providerId = 'provider-123';

  beforeEach(() => {
    jest.clearAllMocks();
    providerRepository.findById = jest.fn().mockResolvedValue({
      _id: providerId,
      ownerId: userId,
      label: 'OpenAI',
    });
  });

  test('create returns top-level agentId and data with id + _id', async () => {
    agentService.createAgent = jest.fn().mockResolvedValue({
      _id: 'agent-456',
      name: 'Research Assistant',
      systemPrompt: 'You are a research assistant.',
    });

    const tool = upsertAgentTool(userId);
    const result = JSON.parse(
      await tool.invoke({
        name: 'Research Assistant',
        systemPrompt: 'You are a research assistant.',
        providerId,
      })
    );

    expect(result.status).toBe('success');
    expect(result.agentId).toBe('agent-456');
    expect(result.data.id).toBe('agent-456');
    expect(result.data._id).toBe('agent-456');
  });

  test('update returns top-level agentId and data with id + _id', async () => {
    agentService.updateAgent = jest.fn().mockResolvedValue({
      _id: 'agent-789',
      name: 'Updated Agent',
    });

    const tool = upsertAgentTool(userId);
    const result = JSON.parse(await tool.invoke({ agentId: 'agent-789', name: 'Updated Agent' }));

    expect(result.status).toBe('success');
    expect(result.agentId).toBe('agent-789');
    expect(result.data.id).toBe('agent-789');
    expect(result.data._id).toBe('agent-789');
  });

  test('create without required fields returns error status', async () => {
    const tool = upsertAgentTool(userId);
    const result = JSON.parse(await tool.invoke({ name: 'Only a name' }));

    expect(result.status).toBe('error');
    expect(result.agentId).toBeUndefined();
  });
});

describe('HITL interrupt translation', () => {
  const hitlValue = {
    actionRequests: [
      { name: 'upsert_agent', args: { name: 'Bot' }, description: 'needs approval' },
    ],
    reviewConfigs: [
      { actionName: 'upsert_agent', allowedDecisions: ['approve', 'edit', 'reject'] },
    ],
  };

  function fakeStream(events, failWith) {
    return (async function* () {
      for (const e of events) yield e;
      if (failWith) throw failWith;
    })();
  }

  async function collect(gen) {
    const out = [];
    for await (const ev of gen) out.push(ev);
    return out;
  }

  test('describeInterrupt classifies HITL vs clarification payloads', () => {
    expect(describeInterrupt([{ value: hitlValue }])).toMatchObject({
      kind: 'hitl',
      actionCount: 1,
    });
    expect(describeInterrupt([{ value: { questions: [{ text: 'Which model?' }] } }])).toMatchObject({
      kind: 'clarification',
      actionCount: 0,
      questions: [
        {
          id: 'question_1',
          text: 'Which model?',
          options: [],
          required: true,
          allowCustom: true,
        },
      ],
    });
  });

  test('buildInterruptNotice renders pending actions for HITL interrupts', () => {
    const notice = buildInterruptNotice([{ value: hitlValue }]);
    expect(notice).toContain('upsert_agent');
    expect(notice.toLowerCase()).toContain('approv');
  });

  test('stream emits CUSTOM hitl_request event and reports kind to onInterrupt', async () => {
    const interruptError = Object.assign(new Error('GraphInterrupt'), {
      name: 'GraphInterrupt',
      interrupts: [{ value: hitlValue }],
    });
    const onInterrupt = jest.fn();

    const events = await collect(
      translateLangGraphStream(fakeStream([], interruptError), { onInterrupt })
    );

    expect(onInterrupt).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'hitl', actionCount: 1 })
    );

    const custom = events.find((e) => e.type === EventType.CUSTOM);
    expect(custom).toBeDefined();
    expect(custom.name).toBe('hitl_request');
    expect(custom.value.actionRequests).toEqual(hitlValue.actionRequests);
    expect(custom.value.reviewConfigs).toEqual(hitlValue.reviewConfigs);

    // A readable text notice still follows for the transcript.
    const text = events.find((e) => e.type === EventType.TEXT_MESSAGE_CHUNK);
    expect(text.delta).toContain('upsert_agent');
  });

  test('clarification interrupts emit a structured CUSTOM event', async () => {
    const interruptError = Object.assign(new Error('GraphInterrupt'), {
      name: 'GraphInterrupt',
      interrupts: [{ value: { questions: [{ id: 'model', text: 'Which model?', options: ['GPT', 'Claude'] }] } }],
    });
    const onInterrupt = jest.fn();

    const events = await collect(
      translateLangGraphStream(fakeStream([], interruptError), { onInterrupt })
    );

    expect(onInterrupt).toHaveBeenCalledWith(expect.objectContaining({ kind: 'clarification' }));
    const custom = events.find((e) => e.type === EventType.CUSTOM);
    expect(custom).toMatchObject({
      name: 'clarification_request',
      value: {
        currentIndex: 0,
        questions: [
          {
            id: 'model',
            text: 'Which model?',
            options: ['GPT', 'Claude'],
            required: true,
            allowCustom: true,
          },
        ],
      },
    });
  });
});

describe('buildResumeValue', () => {
  test('clarification interrupts resume with raw text', () => {
    expect(
      buildResumeValue({ kind: 'clarification', actionCount: 0 }, undefined, 'gpt-4o please')
    ).toBe('gpt-4o please');
  });

  test('clarification interrupts forward structured answers from the client', () => {
    const answers = [
      {
        questionId: 'format',
        question: 'What format?',
        answer: 'Bullet points',
        optionIndex: 0,
        freeform: false,
        skipped: false,
      },
    ];
    expect(
      buildResumeValue(
        { kind: 'clarification', actionCount: 0 },
        { answers, text: 'Q: What format?\nA: Bullet points' },
        'fallback'
      )
    ).toEqual({ answers, text: 'Q: What format?\nA: Bullet points' });
  });

  test('HITL interrupts forward structured decisions from the client', () => {
    const decisions = [{ type: 'approve' }];
    expect(buildResumeValue({ kind: 'hitl', actionCount: 1 }, { decisions }, 'Approved')).toEqual({
      decisions,
    });
  });

  test('HITL interrupts translate plain text into reject-with-feedback per action', () => {
    const value = buildResumeValue(
      { kind: 'hitl', actionCount: 2 },
      undefined,
      'No, rename it first'
    );
    expect(value.decisions).toHaveLength(2);
    for (const decision of value.decisions) {
      expect(decision).toEqual({ type: 'reject', message: 'No, rename it first' });
    }
  });

  test('HITL interrupts with no text fall back to a default reject message', () => {
    const value = buildResumeValue({ kind: 'hitl', actionCount: 1 }, undefined, '');
    expect(value.decisions[0].type).toBe('reject');
    expect(value.decisions[0].message).toBeTruthy();
  });
});

describe('ask_clarification tool', () => {
  test('is configured with the expected interrupting tool contract', () => {
    const tool = askClarificationTool();

    expect(tool.name).toBe('ask_clarification');
    expect(tool.description).toContain('Pause the agent');
  });
});
