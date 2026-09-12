import type { HttpClient } from '../http.js';
import type { Logger } from '../logger.js';
import { createLogger } from '../logger.js';
import { parseAguiEventStream } from '../chat/sse.js';
import { EventType } from '../types/chat.js';
import type { PaginatedResult } from '../types/pagination.js';
import type {
  CreateWorkflowInput,
  DiscoverWorkflowsParams,
  ListWorkflowRunsParams,
  ListWorkflowVersionsParams,
  NodeRun,
  RunWorkflowOptions,
  UpdateWorkflowInput,
  Workflow,
  WorkflowDraft,
  WorkflowRun,
  WorkflowRunResult,
  WorkflowRunStatus,
  WorkflowStreamEvent,
  WorkflowUsage,
  WorkflowVersion,
} from '../types/workflow.js';

/**
 * Workflows (`/api/v1/developer/workflows`) — multi-agent orchestration
 * pipelines composed of agents, deterministic tools, knowledge bases,
 * and outputs compiled to LangGraph StateGraphs and monitored via AG-UI SSE.
 */
export class WorkflowsResource {
  private readonly logger: Logger;

  constructor(
    private readonly http: HttpClient,
    logger?: Logger
  ) {
    this.logger = logger ?? createLogger('sdk:workflows');
  }

  /**
   * Creates a new Workflow definition.
   * @param input - `name` is required. Optional `description`, `visibility`, `isEnabled`, `draft`.
   * @param idempotencyKey - Optional `Idempotency-Key` header to safely retry requests without duplicates.
   */
  async create(input: CreateWorkflowInput, idempotencyKey?: string): Promise<Workflow> {
    return this.http.request<Workflow>('POST', '/api/v1/developer/workflows', {
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  /**
   * Lists Workflows visible to this Project credential.
   * @param params - `page`, `limit`, `search`, `scope` ('mine' | 'public' | 'all'), `visibility`, `isEnabled`.
   */
  async list(params: DiscoverWorkflowsParams = {}): Promise<PaginatedResult<Workflow>> {
    return this.http.request<PaginatedResult<Workflow>>('GET', '/api/v1/developer/workflows', {
      query: { ...params },
    });
  }

  /**
   * Fetches a single Workflow by ID, including its active draft.
   * @param workflowId - The Workflow's `_id`.
   */
  async get(workflowId: string): Promise<Workflow> {
    return this.http.request<Workflow>('GET', `/api/v1/developer/workflows/${workflowId}`);
  }

  /**
   * Partially updates a Workflow's metadata or draft.
   * @param workflowId - The Workflow's `_id`.
   * @param input - Any subset of updatable workflow fields.
   */
  async update(workflowId: string, input: UpdateWorkflowInput): Promise<Workflow> {
    return this.http.request<Workflow>('PATCH', `/api/v1/developer/workflows/${workflowId}`, {
      body: input,
    });
  }

  /**
   * Deletes a Workflow.
   * @param workflowId - The Workflow's `_id`.
   */
  async delete(workflowId: string): Promise<{ success: boolean; message?: string }> {
    return this.http.request<{ success: boolean; message?: string }>(
      'DELETE',
      `/api/v1/developer/workflows/${workflowId}`
    );
  }

  /**
   * Saves the visual canvas draft (`nodes`, `edges`, `trigger`).
   * Validates DAG reachability and cycle freedom before saving.
   * @param workflowId - The Workflow's `_id`.
   * @param draft - The canvas nodes, edges, and trigger configuration.
   */
  async saveDraft(workflowId: string, draft: WorkflowDraft): Promise<Workflow> {
    return this.http.request<Workflow>(
      'PUT',
      `/api/v1/developer/workflows/${workflowId}/draft`,
      {
        body: { draft },
      }
    );
  }

  /**
   * Publishes the current draft as an immutable version snapshot.
   * Pins snapshots of referenced agents.
   * @param workflowId - The Workflow's `_id`.
   */
  async publish(workflowId: string): Promise<WorkflowVersion> {
    return this.http.request<WorkflowVersion>(
      'POST',
      `/api/v1/developer/workflows/${workflowId}/publish`
    );
  }

  /**
   * Lists published immutable versions of a workflow.
   * @param workflowId - The Workflow's `_id`.
   * @param params - `page` (default 1), `limit` (default 20).
   */
  async listVersions(
    workflowId: string,
    params: ListWorkflowVersionsParams = {}
  ): Promise<PaginatedResult<WorkflowVersion>> {
    return this.http.request<PaginatedResult<WorkflowVersion>>(
      'GET',
      `/api/v1/developer/workflows/${workflowId}/versions`,
      {
        query: { ...params },
      }
    );
  }

  /**
   * Retrieves a specific published version snapshot by version number.
   * @param workflowId - The Workflow's `_id`.
   * @param version - Integer version number.
   */
  async getVersion(workflowId: string, version: number): Promise<WorkflowVersion> {
    return this.http.request<WorkflowVersion>(
      'GET',
      `/api/v1/developer/workflows/${workflowId}/versions/${version}`
    );
  }

  /**
   * Exports the workflow graph topology as standard Mermaid flowchart markdown.
   * @param workflowId - The Workflow's `_id`.
   */
  async getMermaid(workflowId: string): Promise<{ mermaid: string }> {
    return this.http.request<{ mermaid: string }>(
      'GET',
      `/api/v1/developer/workflows/${workflowId}/mermaid`
    );
  }

  /**
   * Lists historical execution runs for a workflow.
   * @param workflowId - The Workflow's `_id`.
   * @param params - `page`, `limit`, `status`, `isDryRun`.
   */
  async listRuns(
    workflowId: string,
    params: ListWorkflowRunsParams = {}
  ): Promise<PaginatedResult<WorkflowRun>> {
    return this.http.request<PaginatedResult<WorkflowRun>>(
      'GET',
      `/api/v1/developer/workflows/${workflowId}/runs`,
      {
        query: { ...params },
      }
    );
  }

  /**
   * Retrieves full execution trace and metrics for a specific run.
   * @param runId - The run's `_id`.
   */
  async getRun(runId: string): Promise<WorkflowRun> {
    return this.http.request<WorkflowRun>('GET', `/api/v1/developer/workflows/runs/${runId}`);
  }

  /**
   * Aborts an in-flight workflow run.
   * Cancels active LLM and tool steps, marks the run status as `cancelled`,
   * and emits a cancellation AG-UI event frame to active stream subscribers.
   * @param runId - The run's `_id`.
   */
  async cancel(runId: string): Promise<WorkflowRun> {
    return this.http.request<WorkflowRun>(
      'POST',
      `/api/v1/developer/workflows/runs/${runId}/cancel`
    );
  }

  /**
   * Executes a workflow with real-time SSE event streaming.
   * Yields sequence-ordered AG-UI telemetry frames (`RUN_STARTED`, `CUSTOM` node events,
   * child step tokens/tool calls tagged with `parentStepId`, `RUN_FINISHED`, `RUN_ERROR`).
   * @param workflowId - The Workflow to execute.
   * @param options.input - Input payload passed to the workflow's trigger node.
   * @param options.dryRun - When true, runs in sandbox mode: intercepts destructive tools and bypasses billing deduction.
   * @param options.version - Optional specific published version to execute (defaults to active draft or latest published).
   * @param options.signal - AbortSignal to cancel client HTTP streaming.
   * @yields Each parsed {@link WorkflowStreamEvent} as it arrives over SSE.
   */
  async *stream(
    workflowId: string,
    options: RunWorkflowOptions = {}
  ): AsyncGenerator<WorkflowStreamEvent> {
    this.logger.debug('workflow stream start', {
      workflowId,
      isDryRun: !!options.dryRun,
      version: options.version,
    });

    const response = await this.http.request<Response>(
      'POST',
      `/api/v1/developer/workflows/${workflowId}/runs`,
      {
        headers: { Accept: 'text/event-stream' },
        body: {
          input: options.input,
          dryRun: options.dryRun,
          isDryRun: options.dryRun,
          version: options.version,
          stream: true,
        },
        signal: options.signal,
      }
    );

    for await (const event of parseAguiEventStream(response, this.logger)) {
      yield event as WorkflowStreamEvent;
    }
  }

  /**
   * Re-attaches to an active in-flight workflow run's SSE stream.
   * Replays buffered frames with `seq > sinceSeq` and continues streaming live events.
   * @param runId - The run's `_id`.
   * @param sinceSeq - The last sequence number received by the client (default 0).
   * @param signal - Optional AbortSignal.
   * @yields Each parsed {@link WorkflowStreamEvent} replayed and live.
   */
  async *resumeStream(
    runId: string,
    sinceSeq = 0,
    signal?: AbortSignal
  ): AsyncGenerator<WorkflowStreamEvent> {
    this.logger.debug('workflow stream resume requested', { runId, sinceSeq });

    const response = await this.http.request<Response>(
      'GET',
      `/api/v1/developer/workflows/runs/${runId}/resume`,
      {
        headers: { Accept: 'text/event-stream' },
        query: { sinceSeq },
        signal,
      }
    );

    for await (const event of parseAguiEventStream(response, this.logger)) {
      yield event as WorkflowStreamEvent;
    }
  }

  /**
   * Convenience wrapper over `stream()`: executes the workflow, drains the full
   * event stream, and returns the accumulated run result and metrics.
   * @param workflowId - The Workflow to execute.
   * @param options - Run options (`input`, `dryRun`, `version`, `signal`).
   * @returns Assembled {@link WorkflowRunResult} with status, output, metrics, and event log.
   */
  async run(
    workflowId: string,
    options: RunWorkflowOptions = {}
  ): Promise<WorkflowRunResult> {
    const events: WorkflowStreamEvent[] = [];
    let runId = '';
    let threadId = '';
    let status: WorkflowRunStatus = 'running';
    let isDryRun = Boolean(options.dryRun);
    let output: unknown = undefined;
    let usage: WorkflowUsage | undefined = undefined;
    const nodeRuns: Record<string, NodeRun> = {};

    for await (const event of this.stream(workflowId, options)) {
      events.push(event);

      if (event.type === EventType.RUN_STARTED) {
        const startEvt = event as unknown as {
          runId?: string;
          threadId?: string;
          isDryRun?: boolean;
        };
        if (startEvt.runId) runId = startEvt.runId;
        if (startEvt.threadId) threadId = startEvt.threadId;
        if (startEvt.isDryRun !== undefined) isDryRun = startEvt.isDryRun;
      } else if (event.type === EventType.CUSTOM) {
        const customEvt = event as { name?: string; value?: unknown };
        if (customEvt.name === 'workflow_node_started') {
          const val = customEvt.value as {
            nodeId: string;
            nodeType: string;
            input?: unknown;
            timestamp?: string;
          };
          if (val?.nodeId) {
            nodeRuns[val.nodeId] = {
              nodeId: val.nodeId,
              nodeType: val.nodeType || '',
              status: 'running',
              input: val.input,
              retriesTaken: 0,
              durationMs: 0,
              tokens: 0,
              startedAt: val.timestamp || new Date().toISOString(),
            };
          }
        } else if (customEvt.name === 'workflow_node_completed') {
          const val = customEvt.value as {
            nodeId: string;
            output?: unknown;
            retriesTaken?: number;
            durationMs?: number;
            tokens?: number;
            timestamp?: string;
          };
          const existing = val?.nodeId ? nodeRuns[val.nodeId] : undefined;
          if (existing) {
            existing.status = 'completed';
            existing.output = val.output;
            existing.retriesTaken = val.retriesTaken ?? 0;
            existing.durationMs = val.durationMs ?? 0;
            existing.tokens = val.tokens ?? 0;
            existing.endedAt = val.timestamp || new Date().toISOString();
          }
        } else if (customEvt.name === 'workflow_node_failed') {
          const val = customEvt.value as {
            nodeId: string;
            error?: string;
            timestamp?: string;
          };
          const existing = val?.nodeId ? nodeRuns[val.nodeId] : undefined;
          if (existing) {
            existing.status = 'failed';
            existing.error = val.error;
            existing.endedAt = val.timestamp || new Date().toISOString();
          }
        }

      } else if (event.type === EventType.RUN_FINISHED) {
        const finishEvt = event as unknown as {
          runId?: string;
          output?: unknown;
          usage?: WorkflowUsage;
        };
        if (finishEvt.runId) runId = finishEvt.runId;
        output = finishEvt.output;
        usage = finishEvt.usage;
        status = 'completed';
      } else if (event.type === EventType.RUN_ERROR) {
        const errEvt = event as unknown as { code?: string; message?: string };
        status = errEvt.code === 'EXECUTION_CANCELLED' ? 'cancelled' : 'failed';
        if (output === undefined) {
          output = { error: errEvt.message || 'Workflow run failed' };
        }
      }
    }

    return {
      runId,
      threadId,
      status,
      isDryRun,
      output,
      usage,
      nodeRuns,
      events,
    };
  }
}
