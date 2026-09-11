import { jest } from '@jest/globals';
import {
  detectCycle,
  workflowDraftSchema,
} from '../src/modules/developer/workflows/workflow.validator.js';
import {
  resolveTemplate,
  getByPath,
  extractTemplateVariables,
} from '../src/modules/developer/workflows/templateResolver.js';
import { generateWorkflowMermaid } from '../src/modules/developer/workflows/workflowMermaid.js';
import { WorkflowRunDriver } from '../src/modules/developer/workflows/workflowRunDriver.js';
import workflowUsageService from '../src/modules/developer/workflows/workflowUsage.service.js';
import { EventType } from '@ag-ui/core';

describe('Workflow Engine & Visual Builder Tests', () => {
  describe('Cycle Detection & DAG Validation (Gap 1)', () => {
    test('should accept a linear DAG without cycles', () => {
      const nodes = [
        { id: 'trigger', type: 'trigger', data: { label: 'Trigger' } },
        { id: 'step1', type: 'agentStep', data: { label: 'Agent 1' } },
        { id: 'step2', type: 'toolStep', data: { label: 'Tool 1' } },
        { id: 'output', type: 'output', data: { label: 'Output' } },
      ];
      const edges = [
        { id: 'e1', source: 'trigger', target: 'step1' },
        { id: 'e2', source: 'step1', target: 'step2' },
        { id: 'e3', source: 'step2', target: 'output' },
      ];

      const result = detectCycle(nodes, edges);
      expect(result.hasCycle).toBe(false);
      expect(workflowDraftSchema.safeParse({ nodes, edges }).success).toBe(true);
    });

    test('should accept a diamond branching DAG', () => {
      const nodes = [
        { id: 'trigger', type: 'trigger', data: { label: 'Trigger' } },
        { id: 'cond', type: 'condition', data: { label: 'Condition' } },
        { id: 'branchA', type: 'agentStep', data: { label: 'Agent A' } },
        { id: 'branchB', type: 'agentStep', data: { label: 'Agent B' } },
        { id: 'join', type: 'join', data: { label: 'Join' } },
        { id: 'output', type: 'output', data: { label: 'Output' } },
      ];
      const edges = [
        { id: 'e1', source: 'trigger', target: 'cond' },
        { id: 'e2', source: 'cond', target: 'branchA', conditionValue: 'true' },
        { id: 'e3', source: 'cond', target: 'branchB', conditionValue: 'false' },
        { id: 'e4', source: 'branchA', target: 'join' },
        { id: 'e5', source: 'branchB', target: 'join' },
        { id: 'e6', source: 'join', target: 'output' },
      ];

      const result = detectCycle(nodes, edges);
      expect(result.hasCycle).toBe(false);
    });

    test('should detect a direct 2-node cycle', () => {
      const nodes = [
        { id: 'nodeA', type: 'agentStep', data: { label: 'A' } },
        { id: 'nodeB', type: 'agentStep', data: { label: 'B' } },
      ];
      const edges = [
        { id: 'e1', source: 'nodeA', target: 'nodeB' },
        { id: 'e2', source: 'nodeB', target: 'nodeA' },
      ];

      const result = detectCycle(nodes, edges);
      expect(result.hasCycle).toBe(true);

      const parsed = workflowDraftSchema.safeParse({ nodes, edges });
      expect(parsed.success).toBe(false);
      expect(parsed.error.issues[0].message).toContain('Cycles are not supported in v1');
    });

    test('should detect a transitive 3-node cycle', () => {
      const nodes = [
        { id: 'nodeA', type: 'agentStep', data: { label: 'A' } },
        { id: 'nodeB', type: 'toolStep', data: { label: 'B' } },
        { id: 'nodeC', type: 'knowledgeStep', data: { label: 'C' } },
      ];
      const edges = [
        { id: 'e1', source: 'nodeA', target: 'nodeB' },
        { id: 'e2', source: 'nodeB', target: 'nodeC' },
        { id: 'e3', source: 'nodeC', target: 'nodeA' },
      ];

      const result = detectCycle(nodes, edges);
      expect(result.hasCycle).toBe(true);
    });
  });

  describe('Template Variable Resolution (Gap 6)', () => {
    const mockState = {
      trigger: {
        payload: {
          customerName: 'Alice',
          orderId: 1042,
          items: [{ sku: 'PRO-1', qty: 2 }],
        },
      },
      steps: {
        agent1: {
          output: {
            text: 'I have verified order 1042.',
            confidence: 0.98,
          },
        },
        tool1: {
          output: {
            trackingNumber: 'TRK-9988',
            raw: { status: 'shipped' },
          },
        },
      },
    };

    test('should extract dot paths and array bracket paths correctly', () => {
      expect(getByPath(mockState, 'trigger.payload.customerName')).toBe('Alice');
      expect(getByPath(mockState, 'trigger.payload.items[0].sku')).toBe('PRO-1');
      expect(getByPath(mockState, 'steps.agent1.output.confidence')).toBe(0.98);
      expect(getByPath(mockState, 'steps.nonexistent.output')).toBeUndefined();
    });

    test('should return raw object/value when string is an exact match', () => {
      const resolved = resolveTemplate('{{steps.tool1.output.raw}}', mockState);
      expect(resolved).toEqual({ status: 'shipped' });

      const numberResolved = resolveTemplate('{{trigger.payload.orderId}}', mockState);
      expect(numberResolved).toBe(1042);
    });

    test('should interpolate variables embedded inside a larger string', () => {
      const tpl = 'Hello {{trigger.payload.customerName}}, tracking is {{steps.tool1.output.trackingNumber}}.';
      const resolved = resolveTemplate(tpl, mockState);
      expect(resolved).toBe('Hello Alice, tracking is TRK-9988.');
    });

    test('should extract all variable paths for graph linting', () => {
      const tpl = 'Agent says {{steps.agent1.output.text}} for {{trigger.payload.customerName}}';
      const extracted = extractTemplateVariables(tpl);
      expect(extracted).toContain('steps.agent1.output.text');
      expect(extracted).toContain('trigger.payload.customerName');
    });
  });

  describe('Mermaid Flowchart Exporter', () => {
    test('should export workflow to valid Mermaid flowchart markdown', () => {
      const workflow = {
        draft: {
          nodes: [
            { id: 'trigger_1', type: 'trigger', data: { label: 'Webhook' } },
            { id: 'agent_1', type: 'agentStep', data: { label: 'Triage Agent' } },
            { id: 'output_1', type: 'output', data: { label: 'Final Output' } },
          ],
          edges: [
            { id: 'e1', source: 'trigger_1', target: 'agent_1' },
            { id: 'e2', source: 'agent_1', target: 'output_1' },
          ],
        },
      };

      const mermaid = generateWorkflowMermaid(workflow, 'TD');
      expect(mermaid).toContain('flowchart TD');
      expect(mermaid).toContain('trigger_1(["Webhook (Trigger)"])');
      expect(mermaid).toContain('agent_1["Triage Agent (Agent)"]');
      expect(mermaid).toContain('output_1(["Final Output (Output)"])');
      expect(mermaid).toContain('trigger_1 --> agent_1');
      expect(mermaid).toContain('agent_1 --> output_1');
    });
  });

  describe('WorkflowRunDriver & Reconnection (Pillar B)', () => {
    test('should assign monotonic sequence numbers and buffer frames', () => {
      const driver = new WorkflowRunDriver({
        runId: 'run_test_123',
        workflowId: 'wf_123',
        projectId: 'proj_123',
        threadId: 'th_123',
      });

      driver.pushEvent({ type: EventType.RUN_STARTED, threadId: 'th_123' });
      driver.pushEvent({
        type: EventType.CUSTOM,
        name: 'workflow_node_started',
        value: { nodeId: 'step_1' },
      });

      expect(driver.frames.length).toBe(2);
      expect(driver.frames[0].seq).toBe(1);
      expect(driver.frames[1].seq).toBe(2);
      expect(driver.frames[0].raw).toContain('"seq":1');
    });

    test('should replay missed frames to a reconnected client', () => {
      const driver = new WorkflowRunDriver({
        runId: 'run_test_reconnect',
        workflowId: 'wf_123',
        projectId: 'proj_123',
        threadId: 'th_123',
      });

      driver.pushEvent({ type: EventType.RUN_STARTED });
      driver.pushEvent({ type: EventType.CUSTOM, name: 'workflow_node_started' });
      driver.pushEvent({ type: EventType.CUSTOM, name: 'workflow_node_completed' });

      const written = [];
      const mockRes = {
        setHeader: jest.fn(),
        write: (chunk) => written.push(chunk),
        on: jest.fn(),
        end: jest.fn(),
      };

      // Client reconnects having seen seq 1, requests sinceSeq = 1
      driver.subscribe(mockRes, 1);

      expect(written.length).toBe(2); // Should only replay seq 2 and 3
      expect(written[0]).toContain('"seq":2');
      expect(written[1]).toContain('"seq":3');
    });

    test('should abort execution and emit RUN_ERROR on mid-flight cancellation', async () => {
      const driver = new WorkflowRunDriver({
        runId: 'run_test_abort',
        workflowId: 'wf_123',
        projectId: 'proj_123',
        threadId: 'th_123',
      });

      const written = [];
      const mockRes = {
        setHeader: jest.fn(),
        write: (chunk) => written.push(chunk),
        on: jest.fn(),
        end: jest.fn(),
      };

      driver.subscribe(mockRes);
      expect(driver.signal.aborted).toBe(false);

      await driver.abort('User cancelled test');

      expect(driver.signal.aborted).toBe(true);
      expect(driver.isCancelled).toBe(true);
      const lastFrame = written[written.length - 1];
      expect(lastFrame).toContain('EXECUTION_CANCELLED');
    });
  });

  describe('Usage Calculation & Dry-Run Exemption (Gap 7 & 9)', () => {
    test('should bypass pre-flight balance check when isDryRun is true', async () => {
      const result = await workflowUsageService.checkPreflightBalance('proj_zero_balance', true);
      expect(result.allowed).toBe(true);
      expect(result.isDryRun).toBe(true);
    });

    test('should aggregate tokens and agent turns into usage object', () => {
      const nodeRuns = [
        { nodeType: 'agentStep', tokens: 1200 },
        { nodeType: 'agentStep', tokens: 800 },
        { nodeType: 'toolStep', tokens: 0 },
        { nodeType: 'output', tokens: 0 },
      ];

      const usage = workflowUsageService.calculateUsage(nodeRuns);
      expect(usage.totalTokens).toBe(2000);
      expect(usage.agentTurns).toBe(2);
      expect(usage.creditsDeducted).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Structural Validation & Graph Health (Finding #5)', () => {
    test('should reject workflow without a trigger node', () => {
      const nodes = [
        { id: 'agent1', type: 'agentStep', data: { label: 'Agent 1' } },
        { id: 'output', type: 'output', data: { label: 'Output' } },
      ];
      const edges = [{ id: 'e1', source: 'agent1', target: 'output' }];

      const parsed = workflowDraftSchema.safeParse({ nodes, edges });
      expect(parsed.success).toBe(false);
      expect(parsed.error.issues[0].message).toContain('must have exactly 1 trigger node');
    });

    test('should reject workflow without an output node', () => {
      const nodes = [
        { id: 'trigger', type: 'trigger', data: { label: 'Trigger' } },
        { id: 'agent1', type: 'agentStep', data: { label: 'Agent 1' } },
      ];
      const edges = [{ id: 'e1', source: 'trigger', target: 'agent1' }];

      const parsed = workflowDraftSchema.safeParse({ nodes, edges });
      expect(parsed.success).toBe(false);
      expect(parsed.error.issues[0].message).toContain('must have at least 1 output node');
    });

    test('should reject workflow with disconnected unreachable nodes', () => {
      const nodes = [
        { id: 'trigger', type: 'trigger', data: { label: 'Trigger' } },
        { id: 'output', type: 'output', data: { label: 'Output' } },
        { id: 'orphan_agent', type: 'agentStep', data: { label: 'Orphan' } },
      ];
      const edges = [{ id: 'e1', source: 'trigger', target: 'output' }];

      const parsed = workflowDraftSchema.safeParse({ nodes, edges });
      expect(parsed.success).toBe(false);
      expect(parsed.error.issues[0].message).toContain('Unreachable disconnected node(s): orphan_agent');
    });
  });
});

