import { z } from 'zod';

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
  });

export const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required').max(100),
  description: z.string().max(500).optional(),
  isEnabled: z.boolean().default(true),
  draft: workflowDraftSchema.optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isEnabled: z.boolean().optional(),
  draft: workflowDraftSchema.optional(),
});

export const saveDraftSchema = z.object({
  draft: workflowDraftSchema,
});

export const runWorkflowSchema = z.object({
  input: z.any().optional(),
  dryRun: z.boolean().optional(),
  isDryRun: z.boolean().optional(),
  version: z.number().int().optional(),
});

export const approvalResponseSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  decision: z.enum(['approve', 'reject']),
  comment: z.string().max(1000).optional(),
});
