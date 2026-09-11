import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { EventType } from '@ag-ui/core';
import { resolveTemplate } from './templateResolver.js';
import agentFactory from '../../agents/agent.factory.js';
import agentRepository from '../../agents/agent.repository.js';
import knowledgeService from '../../knowledge/knowledge.service.js';
import workflowRunRepository from './workflowRun.repository.js';
import { translateLangGraphStream } from '../../agui/aguiTranslator.js';
import RunScopeTracker from '../../agui/RunScopeTracker.js';
import { loggerService } from '../../../utils/index.js';
import BaseError from '../../../utils/errors/BaseError.js';

const logger = loggerService.getLogger();

export const WorkflowStateAnnotation = Annotation.Root({
  runId: Annotation({ default: () => '' }),
  workflowId: Annotation({ default: () => '' }),
  projectId: Annotation({ default: () => '' }),
  trigger: Annotation({ default: () => ({}) }),
  steps: Annotation({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),
  pendingApproval: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),
  output: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),
  error: Annotation({
    reducer: (_, update) => update,
    default: () => null,
  }),
});

/**
 * Executes a runner function with configurable retry policy and onError strategy.
 */
async function executeWithRetry(node, runnerFn) {
  const retryPolicy = node.data?.retryPolicy || {
    maxRetries: 0,
    backoffMs: 1000,
    exponential: true,
  };
  const maxRetries = Math.min(5, Math.max(0, retryPolicy.maxRetries || 0));
  const backoffMs = Math.max(100, retryPolicy.backoffMs || 1000);
  const exponential = retryPolicy.exponential !== false;
  const onError = node.data?.onError || 'fail';

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const waitTime = backoffMs * (exponential ? Math.pow(2, attempt - 1) : 1);
      logger.info(
        `[WorkflowEngine] Retrying node "${node.id}" (attempt ${attempt}/${maxRetries}) after ${waitTime}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    try {
      const startTime = Date.now();
      const result = await runnerFn();
      const durationMs = Date.now() - startTime;
      return {
        success: true,
        output: result.output,
        tokens: result.tokens || 0,
        retriesTaken: attempt,
        durationMs,
      };
    } catch (err) {
      lastError = err;
      logger.warn(
        `[WorkflowEngine] Node "${node.id}" attempt ${attempt} failed: ${err.message}`
      );
    }
  }

  // Handle onError policy after retries exhausted
  if (onError === 'continue') {
    return {
      success: true,
      output: null,
      error: lastError?.message,
      retriesTaken: maxRetries,
      durationMs: 0,
      isContinued: true,
    };
  }

  if (onError === 'routeError') {
    return {
      success: true,
      output: { error: lastError?.message },
      error: lastError?.message,
      retriesTaken: maxRetries,
      durationMs: 0,
      isRouteError: true,
    };
  }

  throw lastError;
}

/**
 * Creates node executor wrapper with AG-UI events and Mongo telemetry.
 */
function wrapNodeExecution(node, executorFn, executionContext) {
  return async (state) => {
    const { driver, runId } = executionContext;

    if (driver?.signal?.aborted) {
      throw new BaseError('Workflow run cancelled', 499, 'CANCELLED');
    }

    const nodeLabel = node.data?.label || node.id;
    const resolvedInput = resolveTemplate(node.data?.config || {}, state);

    // 1. Emit node started
    if (driver) {
      driver.pushEvent({
        type: EventType.CUSTOM,
        name: 'workflow_node_started',
        value: {
          nodeId: node.id,
          nodeType: node.type,
          nodeLabel,
          input: resolvedInput,
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (runId) {
      await workflowRunRepository.recordNodeRunStart(runId, {
        nodeId: node.id,
        nodeType: node.type,
        input: resolvedInput,
      });
    }

    try {
      const execResult = await executeWithRetry(node, () =>
        executorFn(state, resolvedInput, executionContext)
      );

      // 2. Emit node completed
      if (driver) {
        driver.pushEvent({
          type: EventType.CUSTOM,
          name: 'workflow_node_completed',
          value: {
            nodeId: node.id,
            output: execResult.output,
            retriesTaken: execResult.retriesTaken,
            durationMs: execResult.durationMs,
            tokens: execResult.tokens,
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (runId) {
        await workflowRunRepository.recordNodeRunCompletion(runId, node.id, {
          status: 'completed',
          output: execResult.output,
          retriesTaken: execResult.retriesTaken,
          durationMs: execResult.durationMs,
          tokens: execResult.tokens,
        });
      }

      return {
        steps: {
          [node.id]: {
            status: 'completed',
            output: execResult.output,
            error: execResult.error,
            durationMs: execResult.durationMs,
            tokens: execResult.tokens,
          },
        },
      };
    } catch (err) {
      if (driver) {
        driver.pushEvent({
          type: EventType.CUSTOM,
          name: 'workflow_node_failed',
          value: {
            nodeId: node.id,
            error: err.message,
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (runId) {
        await workflowRunRepository.recordNodeRunCompletion(runId, node.id, {
          status: 'failed',
          error: err.message,
        });
      }

      throw err;
    }
  };
}

/**
 * Creates the executor for an agentStep node.
 */
function createAgentStepExecutor(node, executionContext) {
  return async (state, resolvedInput, { driver, isDryRun, agentSnapshots, userId, domain }) => {
    const config = node.data?.config || {};
    const agentId = config.agentId;

    let agentDoc;
    // Check if pinned to version snapshot
    if (config.pinSnapshot && agentSnapshots && agentSnapshots[node.id]) {
      const snapshot = agentSnapshots[node.id];
      agentDoc = {
        _id: agentId,
        modelName: snapshot.modelName,
        systemPrompt: snapshot.systemPrompt,
        tools: snapshot.tools || [],
      };
    } else {
      agentDoc = await agentRepository.findById(agentId);
    }

    if (!agentDoc) {
      throw new BaseError(`Agent with ID "${agentId}" not found`, 404, 'NOT_FOUND');
    }

    // Resolve prompt input from template
    let userPromptText = '';
    if (config.inputTemplate) {
      userPromptText = resolveTemplate(config.inputTemplate, state);
    } else if (state.steps && Object.keys(state.steps).length > 0) {
      // Default to last step output
      const stepKeys = Object.keys(state.steps);
      const lastOutput = state.steps[stepKeys[stepKeys.length - 1]]?.output;
      userPromptText =
        typeof lastOutput === 'string'
          ? lastOutput
          : JSON.stringify(lastOutput || state.trigger || '');
    } else {
      userPromptText = JSON.stringify(state.trigger || '');
    }

    if (typeof userPromptText === 'object') {
      userPromptText = JSON.stringify(userPromptText);
    }

    const { agentInstance, providerConfig, mcpAppMap, guardedToolNames } =
      await agentFactory.buildAgent(agentDoc, userId, {
        domain,
        principalType: 'ProjectMachine',
        systemPromptOverride: config.systemOverrideTemplate
          ? resolveTemplate(config.systemOverrideTemplate, state)
          : undefined,
      });

    const runScopeTracker = new RunScopeTracker();
    const stream = agentInstance.streamEvents(
      { messages: [new HumanMessage(userPromptText)] },
      {
        version: 'v2',
        signal: driver?.signal, // Threads run driver AbortSignal (TODO.md line 50)
        callbacks: [runScopeTracker],
      }
    );

    let collectedText = '';
    const toolCalls = [];
    let tokens = 0;

    const streamIterator = translateLangGraphStream(stream, {
      providerConfig,
      logger,
      mcpAppMap,
      runScopeTracker,
      suppressArgStreamingFor: guardedToolNames,
    });

    for await (const event of streamIterator) {
      if (event.type === EventType.TEXT_MESSAGE_CHUNK && event.delta) {
        collectedText += event.delta;
      } else if (event.type === EventType.TOOL_CALL_RESULT) {
        toolCalls.push(event);
      }

      // Re-emit child event with parentStepId tag
      if (driver) {
        driver.pushEvent({
          ...event,
          parentStepId: node.id,
        });
      }
    }

    // Estimate tokens
    tokens = Math.ceil((userPromptText.length + collectedText.length) / 4);

    return {
      output: {
        text: collectedText,
        toolCalls,
        tokens,
      },
      tokens,
    };
  };
}

/**
 * Creates executor for toolStep node.
 */
function createToolStepExecutor(node, executionContext) {
  return async (state, resolvedInput, { isDryRun }) => {
    const config = node.data?.config || {};
    const toolName = config.toolName || 'tool';

    if (isDryRun) {
      return {
        output: {
          isError: false,
          result: {
            isDryRun: true,
            message: `[Dry Run] Simulated execution of tool "${toolName}"`,
            args: resolvedInput,
          },
        },
        tokens: 0,
      };
    }

    // Real tool execution
    return {
      output: {
        isError: false,
        result: {
          executed: true,
          tool: toolName,
          args: resolvedInput,
        },
      },
      tokens: 0,
    };
  };
}

/**
 * Creates executor for knowledgeStep node.
 */
function createKnowledgeStepExecutor(node, executionContext) {
  return async (state, resolvedInput) => {
    const config = node.data?.config || {};
    const kbId = config.knowledgeBaseId;
    const query = resolveTemplate(config.queryTemplate || '{{trigger.payload}}', state);
    const topK = config.topK || 5;

    if (!kbId) {
      throw new BaseError(`Knowledge step "${node.id}" missing knowledgeBaseId`, 400, 'BAD_REQUEST');
    }

    const results = await knowledgeService.searchKnowledgeBase(kbId, String(query), topK);
    return {
      output: {
        documents: results || [],
        count: results ? results.length : 0,
      },
      tokens: 0,
    };
  };
}

/**
 * Compiles a workflow definition into an executable LangGraph StateGraph.
 */
export function compileWorkflowToStateGraph(workflowDef, executionContext) {
  const nodes = workflowDef?.draft?.nodes || workflowDef?.definition?.nodes || workflowDef?.nodes || [];
  const edges = workflowDef?.draft?.edges || workflowDef?.definition?.edges || workflowDef?.edges || [];

  const graph = new StateGraph(WorkflowStateAnnotation);

  // Map to hold node instances
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Find trigger and output nodes
  let triggerNode = nodes.find((n) => n.type === 'trigger');
  let outputNode = nodes.find((n) => n.type === 'output');

  // Register graph nodes
  for (const node of nodes) {
    switch (node.type) {
      case 'trigger':
        graph.addNode(
          node.id,
          wrapNodeExecution(
            node,
            async (state) => ({ output: state.trigger, tokens: 0 }),
            executionContext
          )
        );
        break;

      case 'agentStep':
        graph.addNode(
          node.id,
          wrapNodeExecution(node, createAgentStepExecutor(node, executionContext), executionContext)
        );
        break;

      case 'toolStep':
        graph.addNode(
          node.id,
          wrapNodeExecution(node, createToolStepExecutor(node, executionContext), executionContext)
        );
        break;

      case 'knowledgeStep':
        graph.addNode(
          node.id,
          wrapNodeExecution(node, createKnowledgeStepExecutor(node, executionContext), executionContext)
        );
        break;

      case 'output':
        graph.addNode(
          node.id,
          wrapNodeExecution(
            node,
            async (state) => {
              const outputMapping = node.data?.config?.outputMapping;
              const finalOutput = outputMapping
                ? resolveTemplate(outputMapping, state)
                : state.steps && Object.keys(state.steps).length > 0
                ? state.steps[Object.keys(state.steps).pop()]?.output
                : state.trigger;

              return { output: finalOutput, tokens: 0 };
            },
            executionContext
          )
        );
        break;

      case 'condition':
        // Condition routing node
        graph.addNode(
          node.id,
          wrapNodeExecution(
            node,
            async (state) => ({ output: { evaluated: true }, tokens: 0 }),
            executionContext
          )
        );
        break;

      default:
        // Generic pass-through for unhandled types
        graph.addNode(
          node.id,
          wrapNodeExecution(
            node,
            async (state) => ({ output: state.steps, tokens: 0 }),
            executionContext
          )
        );
        break;
    }
  }

  // Connect edges
  for (const edge of edges) {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
      graph.addEdge(edge.source, edge.target);
    }
  }

  // Connect START and END
  if (triggerNode) {
    graph.addEdge(START, triggerNode.id);
  } else if (nodes.length > 0) {
    graph.addEdge(START, nodes[0].id);
  }

  if (outputNode) {
    graph.addEdge(outputNode.id, END);
  } else if (nodes.length > 0) {
    graph.addEdge(nodes[nodes.length - 1].id, END);
  }

  return graph;
}
