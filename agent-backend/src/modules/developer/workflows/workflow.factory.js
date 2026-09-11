import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { EventType } from '@ag-ui/core';
import { resolveTemplate } from './templateResolver.js';
import agentFactory from '../../agents/agent.factory.js';
import agentRepository from '../../agents/agent.repository.js';
import knowledgeService from '../../knowledge/knowledge.service.js';
import workflowRunRepository from './workflowRun.repository.js';
import restApiToolService from '../../restApiTools/restApiTool.service.js';
import restApiToolRepository from '../../restApiTools/restApiTool.repository.js';
import { translateLangGraphStream } from '../../agui/aguiTranslator.js';
import { RunScopeTracker } from '../../agui/RunScopeTracker.js';
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

    logger.debug(`[WorkflowEngine] node "${node.id}" (${node.type}) starting`, { runId, nodeLabel });

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

      logger.debug(`[WorkflowEngine] node "${node.id}" (${node.type}) completed`, {
        runId,
        durationMs: execResult.durationMs,
        retriesTaken: execResult.retriesTaken,
      });

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

      const stateUpdate = {
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

      // The Output node's result is the workflow's overall result — surface it
      // on the graph's top-level `output` channel too, not just `steps`, since
      // that's what runWorkflow's finalState.output (and therefore the
      // RUN_FINISHED SSE event / persisted run doc) actually reads.
      if (node.type === 'output') {
        stateUpdate.output = execResult.output;
      }

      return stateUpdate;
    } catch (err) {
      logger.warn(`[WorkflowEngine] node "${node.id}" (${node.type}) failed: ${err.message}`, { runId });

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
  return async (state, resolvedInput, { driver, isDryRun, agentSnapshots, userId, domain, runId }) => {
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
        agentType: snapshot.agentType || 'deepagent',
      };
    } else {
      agentDoc = await agentRepository.findById(agentId);
    }

    if (!agentDoc) {
      logger.warn(`[WorkflowEngine] agentStep "${node.id}" references missing agent`, { agentId });
      throw new BaseError(`Agent with ID "${agentId}" not found`, 404, 'NOT_FOUND');
    }

    // In dry-run mode, strip external destructive tools from the agent so the LLM
    // does not perform external live side-effects (Finding #3 in review.md).
    let effectiveAgentDoc = agentDoc;
    if (isDryRun) {
      logger.debug(`[WorkflowEngine] agentStep "${node.id}" running in dry-run mode, stripping external tools`, { agentId });
      effectiveAgentDoc = {
        ...(typeof agentDoc.toObject === 'function' ? agentDoc.toObject() : agentDoc),
        // Strip all external mutating/destructive tool configs including MCPs
        mcps: [],
        restApiTools: [],
        restApiToolSources: [],
        rcpSources: [],
      };
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
      await agentFactory.buildAgent(effectiveAgentDoc, userId, null, {
        domain,
        principalType: 'ProjectMachine',
        isDryRun: Boolean(isDryRun),
        systemPromptOverride: config.systemOverrideTemplate
          ? resolveTemplate(config.systemOverrideTemplate, state)
          : undefined,
      });

    const runScopeTracker = new RunScopeTracker();
    const stream = agentInstance.streamEvents(
      { messages: [new HumanMessage(userPromptText)] },
      {
        // This executor runs *inside* a Pregel task of the outer workflow
        // StateGraph (compileWorkflowToStateGraph). LangGraph's checkpoint_ns
        // computation (`configurable.checkpoint_ns ?? ''`, see
        // @langchain/langgraph/dist/pregel/algo.js) reads that ambient config
        // — which RunnableConfig auto-propagates to any nested Runnable
        // invoked in the same async context, even without a manual config
        // threaded through here. Left alone, the inner deepagents graph's own
        // checkpoint_ns gets prefixed with the OUTER graph's current node
        // namespace (e.g. "agentStep_xyz:<taskId>|tools:<taskId>"), which the
        // AG-UI translator's isNestedNamespace() reads as "one segment deeper
        // than root" and misclassifies as a genuine subagent (deepagents
        // `task` tool) call with no registered host — silently dropping it,
        // including the model's actual final answer (nestedChunks, not
        // textChunks). Explicitly resetting checkpoint_ns to '' makes this
        // invocation root-relative again, matching the normal chat path
        // (agui.service.js), where streamEvents is called at the true top
        // level and never inherits an outer graph's namespace.
        configurable: { thread_id: `${runId}:${node.id}`, checkpoint_ns: '' },
        version: 'v2',
        signal: driver?.signal, // Threads run driver AbortSignal (Finding #8 in review.md)
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
      if (driver?.signal?.aborted) {
        throw new BaseError('Workflow run cancelled', 499, 'CANCELLED');
      }

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

    logger.debug(`[WorkflowEngine] agentStep "${node.id}" agent run complete`, {
      agentId,
      toolCallCount: toolCalls.length,
      estimatedTokens: tokens,
    });

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
 * Creates executor for toolStep node (Finding #2 in review.md).
 * Supports both dry-run sandbox simulation and real tool invocation.
 */
function createToolStepExecutor(node, executionContext) {
  return async (state, resolvedInput, { isDryRun, driver }) => {
    if (driver?.signal?.aborted) {
      throw new BaseError('Workflow run cancelled', 499, 'CANCELLED');
    }

    const config = node.data?.config || {};
    const toolName = config.toolName || 'tool';

    if (isDryRun) {
      logger.debug(`[WorkflowEngine] toolStep "${node.id}" simulated (dry run)`, { toolName });
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

    // Real tool execution: execute configured action/function
    try {
      let resultData;
      if (typeof config.handler === 'function') {
        logger.debug(`[WorkflowEngine] toolStep "${node.id}" invoking handler function`, { toolName });
        resultData = await config.handler(resolvedInput, { signal: driver?.signal });
      } else if (config.url) {
        // Direct HTTP / Webhook tool step
        logger.debug(`[WorkflowEngine] toolStep "${node.id}" calling webhook`, { toolName, url: config.url });
        const method = (config.method || 'POST').toUpperCase();
        const headers = {
          'Content-Type': 'application/json',
          ...(config.headers || {}),
        };
        const body =
          method !== 'GET' && method !== 'HEAD'
            ? typeof resolvedInput === 'string'
              ? resolvedInput
              : JSON.stringify(resolvedInput)
            : undefined;

        const res = await fetch(config.url, {
          method,
          headers,
          body,
          signal: driver?.signal,
        });

        const text = await res.text();
        let parsed;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = text;
        }

        resultData = {
          executed: true,
          status: res.status,
          ok: res.ok,
          data: parsed,
          tool: toolName,
        };
      } else if (config.toolId || config.restApiToolId) {
        // Registered REST API Tool execution by ID
        const targetId = config.toolId || config.restApiToolId;
        const restTool = await restApiToolRepository.findById(targetId);
        if (!restTool) {
          logger.warn(`[WorkflowEngine] toolStep "${node.id}" references missing REST API tool`, { targetId });
          throw new BaseError(`Rest API Tool ${targetId} not found`, 404, 'NOT_FOUND');
        }
        logger.debug(`[WorkflowEngine] toolStep "${node.id}" calling registered REST API tool`, { targetId });
        resultData = await restApiToolService.testCall(
          executionContext,
          restTool,
          typeof resolvedInput === 'object' ? resolvedInput : { query: resolvedInput },
          targetId
        );
      } else {
        // Structured tool execution payload
        resultData = {
          executed: true,
          tool: toolName,
          result: resolvedInput,
          executedAt: new Date().toISOString(),
        };
      }

      return {
        output: {
          isError: false,
          result: resultData,
        },
        tokens: 0,
      };
    } catch (err) {
      if (err.name === 'AbortError' || driver?.signal?.aborted) {
        throw new BaseError('Workflow run cancelled', 499, 'CANCELLED');
      }
      logger.warn(`[WorkflowEngine] toolStep "${node.id}" execution error: ${err.message}`, { toolName });
      return {
        output: {
          isError: true,
          error: err.message,
        },
        tokens: 0,
      };
    }
  };
}

/**
 * Creates executor for knowledgeStep node.
 * Honors abort signal (Finding #8 in review.md).
 */
function createKnowledgeStepExecutor(node, executionContext) {
  return async (state, resolvedInput, { driver }) => {
    if (driver?.signal?.aborted) {
      throw new BaseError('Workflow run cancelled', 499, 'CANCELLED');
    }

    const config = node.data?.config || {};
    const kbId = config.knowledgeBaseId;
    const query = resolveTemplate(config.queryTemplate || '{{trigger.payload}}', state);
    const topK = config.topK || 5;

    if (!kbId) {
      logger.warn(`[WorkflowEngine] knowledgeStep "${node.id}" missing knowledgeBaseId`);
      throw new BaseError(`Knowledge step "${node.id}" missing knowledgeBaseId`, 400, 'BAD_REQUEST');
    }

    logger.debug(`[WorkflowEngine] knowledgeStep "${node.id}" searching knowledge base`, { kbId, topK });
    const results = await knowledgeService.searchKnowledgeBase(kbId, String(query), topK);
    logger.debug(`[WorkflowEngine] knowledgeStep "${node.id}" search complete`, { kbId, resultCount: results?.length || 0 });
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

  logger.debug('[WorkflowEngine] compiling workflow graph', { nodeCount: nodes.length, edgeCount: edges.length });

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
              const outputType = node.data?.config?.outputType || 'text';
              let finalOutput = outputMapping
                ? resolveTemplate(outputMapping, state)
                : state.steps && Object.keys(state.steps).length > 0
                ? state.steps[Object.keys(state.steps).pop()]?.output
                : state.trigger;

              // Parse JSON if outputType is json (Low finding in review.md)
              if (outputType === 'json' && typeof finalOutput === 'string') {
                try {
                  finalOutput = JSON.parse(finalOutput);
                } catch {
                  // Fall back to original string if not valid JSON
                }
              }

              return { output: finalOutput, tokens: 0 };
            },
            executionContext
          )
        );
        break;

      case 'condition':
        // Condition routing node (Finding #4 in review.md)
        graph.addNode(
          node.id,
          wrapNodeExecution(
            node,
            async (state) => {
              const config = node.data?.config || {};
              const expression = config.expression || 'true';
              let evaluated = false;
              try {
                // If expression is a template, resolve it
                const resolved = resolveTemplate(expression, state);
                if (typeof resolved === 'boolean') {
                  evaluated = resolved;
                } else if (typeof resolved === 'string') {
                  const normalized = resolved.trim().toLowerCase();
                  evaluated = normalized !== 'false' && normalized !== '0' && normalized !== '';
                } else {
                  evaluated = Boolean(resolved);
                }
              } catch (e) {
                evaluated = false;
              }

              return {
                output: {
                  branch: evaluated ? 'true' : 'false',
                  evaluated,
                },
                tokens: 0,
              };
            },
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

  // Identify condition nodes with branching edges
  const conditionNodeIds = new Set(nodes.filter((n) => n.type === 'condition').map((n) => n.id));
  const standardEdges = [];
  const conditionEdgesMap = new Map(); // conditionNodeId -> { trueTarget, falseTarget }

  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue;

    if (conditionNodeIds.has(edge.source)) {
      if (!conditionEdgesMap.has(edge.source)) {
        conditionEdgesMap.set(edge.source, { trueTarget: null, falseTarget: null });
      }
      const mapping = conditionEdgesMap.get(edge.source);
      const handle = (edge.sourceHandle || edge.conditionValue || '').toLowerCase();

      if (handle === 'true' || handle === 'yes' || !mapping.trueTarget) {
        mapping.trueTarget = edge.target;
      } else {
        mapping.falseTarget = edge.target;
      }
    } else {
      standardEdges.push(edge);
    }
  }

  // Connect standard edges
  for (const edge of standardEdges) {
    graph.addEdge(edge.source, edge.target);
  }

  // Connect conditional edges (Finding #4 in review.md)
  for (const [condId, mapping] of conditionEdgesMap.entries()) {
    const trueNode = mapping.trueTarget || END;
    const falseNode = mapping.falseTarget || mapping.trueTarget || END;

    graph.addConditionalEdges(condId, (state) => {
      const stepResult = state.steps?.[condId];
      const branch = stepResult?.output?.branch;
      return branch === 'true' ? 'trueBranch' : 'falseBranch';
    }, {
      trueBranch: trueNode,
      falseBranch: falseNode,
    });
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

  logger.debug('[WorkflowEngine] workflow graph compiled', {
    conditionNodeCount: conditionNodeIds.size,
    standardEdgeCount: standardEdges.length,
  });

  return graph;
}
