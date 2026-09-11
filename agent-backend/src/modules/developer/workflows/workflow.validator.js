import { z } from 'zod';
import { loggerService } from '../../../utils/index.js';

const logger = loggerService.getLogger();

/**
 * DFS Cycle Detection for Workflow DAG validation (Gap 1 in research.md).
 * Checks if directed edges between nodes form any cycle.
 * Returns { hasCycle: boolean, cycleNode?: string }
 */
export function detectCycle(nodes = [], edges = []) {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adj = new Map();

  for (const nodeId of nodeIds) {
    adj.set(nodeId, []);
  }

  for (const edge of edges) {
    if (adj.has(edge.source)) {
      adj.get(edge.source).push(edge.target);
    }
  }

  // 0 = unvisited, 1 = visiting (on current path), 2 = visited
  const state = new Map();
  for (const nodeId of nodeIds) {
    state.set(nodeId, 0);
  }

  function dfs(nodeId) {
    state.set(nodeId, 1);
    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (state.get(neighbor) === 1) {
        logger.debug('[workflow.validator] cycle detected', { nodeId, neighbor });
        return { hasCycle: true, cycleNode: neighbor };
      }
      if (state.get(neighbor) === 0) {
        const res = dfs(neighbor);
        if (res.hasCycle) return res;
      }
    }
    state.set(nodeId, 2);
    return { hasCycle: false };
  }

  for (const nodeId of nodeIds) {
    if (state.get(nodeId) === 0) {
      const res = dfs(nodeId);
      if (res.hasCycle) return res;
    }
  }

  return { hasCycle: false };
}

export const nodeRetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(5).default(0),
  backoffMs: z.number().int().min(100).default(1000),
  exponential: z.boolean().default(true),
});

export const workflowNodeSchema = z.object({
  id: z.string().min(1, 'Node ID is required'),
  type: z.enum([
    'trigger',
    'agentStep',
    'knowledgeStep',
    'toolStep',
    'condition',
    'approval',
    'parallel',
    'join',
    'output',
  ]),
  position: z
    .object({
      x: z.number().default(0),
      y: z.number().default(0),
    })
    .optional(),
  data: z.object({
    label: z.string().min(1, 'Node label is required'),
    description: z.string().optional(),
    config: z.record(z.string(), z.any()).default({}),
    retryPolicy: nodeRetryPolicySchema.optional(),
    onError: z.enum(['fail', 'continue', 'routeError']).default('fail'),
  }),
});

export const workflowEdgeSchema = z.object({
  id: z.string().min(1, 'Edge ID is required'),
  source: z.string().min(1, 'Edge source is required'),
  target: z.string().min(1, 'Edge target is required'),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  condition: z.any().optional(),
  conditionValue: z.string().optional(),
});

export const workflowTriggerSchema = z.object({
  type: z.enum(['manual', 'api', 'webhook', 'schedule', 'chat']).default('manual'),
  config: z.record(z.string(), z.any()).default({}),
});

/**
 * Structural validation for Workflow graphs (Finding #5 in review.md).
 * Ensures:
 * 1. Exactly one trigger node (if nodes are defined)
 * 2. At least one output node (if nodes are defined)
 * 3. No disconnected/unreachable nodes from the trigger (if multiple nodes exist)
 */
export function validateWorkflowStructure(nodes = [], edges = []) {
  if (!nodes || nodes.length === 0) {
    return { isValid: true };
  }

  const triggers = nodes.filter((n) => n.type === 'trigger');
  if (triggers.length !== 1) {
    logger.debug('[workflow.validator] structural validation failed: trigger count', { count: triggers.length });
    return {
      isValid: false,
      error: `Workflow must have exactly 1 trigger node (found ${triggers.length})`,
    };
  }

  const outputs = nodes.filter((n) => n.type === 'output');
  if (outputs.length === 0) {
    logger.debug('[workflow.validator] structural validation failed: no output node');
    return {
      isValid: false,
      error: 'Workflow must have at least 1 output node',
    };
  }

  // Reachability check from the single trigger
  const triggerId = triggers[0].id;
  const adj = new Map();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    if (adj.has(edge.source)) {
      adj.get(edge.source).push(edge.target);
    }
  }

  const reachable = new Set();
  const queue = [triggerId];
  reachable.add(triggerId);

  while (queue.length > 0) {
    const curr = queue.shift();
    const neighbors = adj.get(curr) || [];
    for (const n of neighbors) {
      if (!reachable.has(n)) {
        reachable.add(n);
        queue.push(n);
      }
    }
  }

  const unreachable = nodes.filter((n) => !reachable.has(n.id));
  if (unreachable.length > 0) {
    logger.debug('[workflow.validator] structural validation failed: unreachable nodes', { unreachableNodes: unreachable.map((n) => n.id) });
    return {
      isValid: false,
      error: `Unreachable disconnected node(s): ${unreachable.map((n) => n.id).join(', ')}`,
      unreachableNodes: unreachable.map((n) => n.id),
    };
  }

  return { isValid: true };
}

/**
 * Config-completeness check, run only at execution time (not at save/draft
 * time — an incomplete draft is a normal, valid in-progress state). Catches
 * a node missing a field its executor hard-requires — e.g. an Agent Step
 * with no `agentId` — before compiling the graph, instead of surfacing as
 * `Agent with ID "undefined" not found` deep inside a LangGraph Pregel task
 * after the run has already started.
 */
export function validateNodeConfigsForRun(nodes = []) {
  const errors = [];
  for (const node of nodes) {
    const label = node.data?.label || node.id;
    if (node.type === 'agentStep' && !node.data?.config?.agentId) {
      errors.push(`Agent Step "${label}" has no Agent selected.`);
    } else if (node.type === 'knowledgeStep' && !node.data?.config?.knowledgeBaseId) {
      errors.push(`Knowledge Step "${label}" has no Knowledge Base selected.`);
    }
  }
  if (errors.length > 0) {
    logger.debug('[workflow.validator] node config validation failed', { errors });
  }
  return { isValid: errors.length === 0, errors };
}

export const workflowDraftSchema = z
  .object({
    nodes: z.array(workflowNodeSchema).default([]),
    edges: z.array(workflowEdgeSchema).default([]),
    trigger: workflowTriggerSchema.default({ type: 'manual', config: {} }),
  })
  .superRefine((draft, ctx) => {
    const { hasCycle, cycleNode } = detectCycle(draft.nodes, draft.edges);
    if (hasCycle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Cycles are not supported in v1. Node ${cycleNode || 'unknown'} references an ancestor.`,
      });
    }

    if (draft.nodes && draft.nodes.length > 0) {
      const structural = validateWorkflowStructure(draft.nodes, draft.edges);
      if (!structural.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: structural.error,
        });
      }
    }
  });

export const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required').max(100),
  description: z.string().max(500).optional(),
  isEnabled: z.boolean().default(true),
  visibility: z.enum(['private', 'unlisted', 'public']).default('private'),
  draft: workflowDraftSchema.optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isEnabled: z.boolean().optional(),
  visibility: z.enum(['private', 'unlisted', 'public']).optional(),
  draft: workflowDraftSchema.optional(),
});

export const saveDraftSchema = z.object({
  draft: workflowDraftSchema,
});

export const runWorkflowSchema = z.object({
  input: z.any().optional(),
  dryRun: z.boolean().optional(),
  isDryRun: z.boolean().optional(),
  externalUserId: z.string().optional(),
  version: z.number().int().optional(),
});

export const approvalResponseSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  decision: z.enum(['approve', 'reject']),
  comment: z.string().max(1000).optional(),
});
