import type { AguiEvent } from './chat.js';
import type { PaginatedResult } from './pagination.js';

export type WorkflowNodeType =
  | 'trigger'
  | 'agentStep'
  | 'knowledgeStep'
  | 'toolStep'
  | 'condition'
  | 'approval'
  | 'parallel'
  | 'join'
  | 'output';

export type WorkflowTriggerType = 'manual' | 'api' | 'webhook' | 'schedule' | 'chat';
export type WorkflowVisibility = 'private' | 'unlisted' | 'public';
export type WorkflowOwnerType = 'Project' | 'ExternalUser';
export type NodeOnErrorAction = 'fail' | 'continue' | 'routeError';

export interface NodeRetryPolicy {
  maxRetries?: number;
  backoffMs?: number;
  exponential?: boolean;
}

export interface WorkflowNodeData {
  label: string;
  description?: string;
  config?: Record<string, unknown>;
  retryPolicy?: NodeRetryPolicy;
  onError?: NodeOnErrorAction;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position?: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: unknown;
  conditionValue?: string;
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  config?: Record<string, unknown>;
}

export interface WorkflowDraft {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  trigger?: WorkflowTrigger;
}

export interface Workflow {
  _id: string;
  domain?: string;
  projectId?: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  visibility: WorkflowVisibility;
  ownerType: WorkflowOwnerType;
  externalOwnerId?: string | null;
  draft: WorkflowDraft;
  publishedVersion: number;
  activeRuns: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSnapshot {
  modelName: string;
  systemPrompt: string;
  tools?: string[];
}

export interface WorkflowVersion {
  _id: string;
  workflowId: string;
  projectId: string;
  version: number;
  definition: WorkflowDraft;
  agentSnapshots?: Record<string, AgentSnapshot>;
  publishedBy?: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type NodeRunStatus = 'running' | 'completed' | 'failed' | 'skipped' | 'paused';

export interface NodeRun {
  nodeId: string;
  nodeType: string;
  status: NodeRunStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  retriesTaken: number;
  durationMs: number;
  tokens: number;
  startedAt: string;
  endedAt?: string;
}

export interface WorkflowUsage {
  totalTokens: number;
  agentTurns: number;
  toolCalls: number;
  creditsDeducted: number;
}

export interface WorkflowRun {
  _id: string;
  workflowId: string;
  workflowVersion: number;
  projectId: string;
  triggeredBy: {
    type: WorkflowTriggerType;
    userId?: string;
    details?: unknown;
  };
  status: WorkflowRunStatus;
  isDryRun: boolean;
  nodeRuns: NodeRun[];
  pendingApproval?: {
    nodeId?: string;
    prompt?: string;
    options?: string[];
    requestedAt?: string;
  };
  output?: unknown;
  usage?: WorkflowUsage;
  threadId: string;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  visibility?: WorkflowVisibility;
  isEnabled?: boolean;
  draft?: WorkflowDraft;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  visibility?: WorkflowVisibility;
  isEnabled?: boolean;
  draft?: WorkflowDraft;
}

export interface DiscoverWorkflowsParams {
  page?: number;
  limit?: number;
  search?: string;
  scope?: 'mine' | 'public' | 'all';
  visibility?: WorkflowVisibility;
  isEnabled?: boolean;
}

export interface ListWorkflowRunsParams {
  page?: number;
  limit?: number;
  status?: WorkflowRunStatus;
  isDryRun?: boolean;
}

export interface ListWorkflowVersionsParams {
  page?: number;
  limit?: number;
}

export interface RunWorkflowOptions {
  input?: unknown;
  dryRun?: boolean;
  version?: number;
  signal?: AbortSignal;
}

export interface WorkflowRunResult {
  runId: string;
  threadId: string;
  status: WorkflowRunStatus;
  isDryRun: boolean;
  output: unknown;
  usage?: WorkflowUsage;
  nodeRuns: Record<string, NodeRun>;
  events: WorkflowStreamEvent[];
}

export type WorkflowStreamEvent = AguiEvent & {
  seq?: number;
  parentStepId?: string;
};

