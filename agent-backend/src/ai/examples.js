import { performance } from 'node:perf_hooks';
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { END, MemorySaver, START, StateGraph, StateSchema } from '@langchain/langgraph';
import { createAgent, FakeToolCallingModel, tool } from 'langchain';
import { createDeepAgent } from 'deepagents';
import { z } from 'zod';
import { loggerService } from '../utils/index.js';

const defaultLogger = loggerService.getLogger();

const CUSTOMER_DIRECTORY = {
  'ada@example.com': {
    name: 'Ada Lovelace',
    tier: 'enterprise',
    region: 'eu-west-1',
    preferredContact: 'email',
  },
  'grace@example.com': {
    name: 'Grace Hopper',
    tier: 'growth',
    region: 'us-east-1',
    preferredContact: 'slack',
  },
};

const POLICY_KB = {
  refunds:
    'Refunds are approved within 5 business days when the incident is verified and logged in the billing system.',
  privacy:
    'Sensitive personal data must be redacted before prompts, traces, or logs are persisted outside the core application boundary.',
};

const toPlainText = (value) => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return part.text;
        return JSON.stringify(part);
      })
      .join('');
  }

  if (value == null) {
    return '';
  }

  return String(value);
};

async function runLoggedStep(name, operation, logger = defaultLogger) {
  const startedAt = performance.now();
  logger.info(`[ai] Starting ${name}`);

  try {
    const result = await operation();
    logger.info(`[ai] Completed ${name}`, {
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
    });
    return result;
  } catch (error) {
    logger.error(`[ai] Failed ${name}`, error);
    throw error;
  }
}

function createCustomerLookupTool() {
  return tool(
    async ({ email }) => {
      const profile = CUSTOMER_DIRECTORY[email.toLowerCase()];

      if (!profile) {
        return `Customer ${email} was not found in the support directory.`;
      }

      return JSON.stringify({ email, ...profile });
    },
    {
      name: 'lookup_customer_profile',
      description:
        'Retrieve a customer profile for backend support workflows before answering account-specific questions.',
      schema: z.object({
        email: z.string().email().describe('Customer email address'),
      }),
    }
  );
}

function createPolicyLookupTool() {
  return tool(
    async ({ topic }) => {
      const normalizedTopic = topic.toLowerCase();
      return POLICY_KB[normalizedTopic] || `No policy snippet exists for ${normalizedTopic}.`;
    },
    {
      name: 'lookup_policy',
      description: 'Fetch a short policy snippet for support and compliance questions.',
      schema: z.object({
        topic: z.string().describe('Policy topic such as refunds or privacy'),
      }),
    }
  );
}

export function createDefaultPromptModel(
  response = 'LangChain standardizes prompts, models, and tools.'
) {
  return new FakeListChatModel({ responses: [response] });
}

export function createDefaultChainModel(
  response = 'Use a low-temperature model, bounded context, and strict output parsing.'
) {
  return new FakeListChatModel({ responses: [response] });
}

export function createDefaultAgentModel(email = 'ada@example.com') {
  return new FakeToolCallingModel({
    toolCalls: [
      [
        {
          id: 'tool-call-customer-1',
          name: 'lookup_customer_profile',
          args: { email },
        },
      ],
      [],
    ],
  });
}

export function createDefaultMemoryAgentModel(email = 'ada@example.com') {
  return new FakeToolCallingModel({
    toolCalls: [
      [
        {
          id: 'tool-call-memory-1',
          name: 'lookup_customer_profile',
          args: { email },
        },
      ],
      [],
      [],
    ],
  });
}

export function createDefaultDeepAgentModel(
  response = 'Deep agent smoke test completed with the batteries-included harness.'
) {
  return new FakeListChatModel({ responses: [response] });
}

export async function runPromptTemplateExample({
  logger = defaultLogger,
  model = createDefaultPromptModel(),
  topic = 'LangChain',
} = {}) {
  return runLoggedStep(
    'langchain.prompt-template',
    async () => {
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', 'You are a backend architecture assistant. Keep answers to one sentence.'],
        ['human', 'Explain {topic} for a JavaScript backend engineer.'],
      ]);

      const chain = prompt.pipe(model).pipe(new StringOutputParser());
      const output = await chain.invoke({ topic });

      return {
        topic,
        output,
      };
    },
    logger
  );
}

export async function runChainExample({
  logger = defaultLogger,
  model = createDefaultChainModel(),
  stack = 'LangChain + LangGraph',
  requirement = 'production-ready observability',
} = {}) {
  return runLoggedStep(
    'langchain.chain',
    async () => {
      const prompt = PromptTemplate.fromTemplate(
        'Recommend a concise backend pattern for {stack} that emphasizes {requirement}.'
      );

      const chain = prompt.pipe(model).pipe(new StringOutputParser());
      const output = await chain.invoke({ stack, requirement });

      return {
        stack,
        requirement,
        output,
      };
    },
    logger
  );
}

export async function runAgentExample({
  logger = defaultLogger,
  model = createDefaultAgentModel(),
  email = 'ada@example.com',
} = {}) {
  return runLoggedStep(
    'langchain.agent',
    async () => {
      const customerLookup = createCustomerLookupTool();
      const agent = createAgent({
        model,
        tools: [customerLookup],
        systemPrompt:
          'You are a support copilot for a Node.js backend. Use tools before answering customer-specific questions.',
      });

      const result = await agent.invoke(
        {
          messages: [
            {
              role: 'user',
              content: `Review the customer profile for ${email} and summarize the account.`,
            },
          ],
        },
        { recursionLimit: 5 }
      );

      return {
        output: toPlainText(result.messages.at(-1)?.content),
        messages: result.messages.length,
      };
    },
    logger
  );
}

export async function runAgentMemoryExample({
  logger = defaultLogger,
  model = createDefaultMemoryAgentModel(),
  email = 'ada@example.com',
  threadId = 'memory-demo-thread',
} = {}) {
  return runLoggedStep(
    'langchain.memory',
    async () => {
      const customerLookup = createCustomerLookupTool();
      const checkpointer = new MemorySaver();
      const agent = createAgent({
        model,
        tools: [customerLookup],
        checkpointer,
        systemPrompt:
          'You are a support copilot. Use the customer lookup tool and rely on conversation memory when the user asks a follow-up question.',
      });

      const config = {
        configurable: { thread_id: threadId },
        recursionLimit: 6,
      };

      await agent.invoke(
        {
          messages: [
            {
              role: 'user',
              content: `Remember the primary customer profile for ${email}.`,
            },
          ],
        },
        config
      );

      const followUp = await agent.invoke(
        {
          messages: [
            {
              role: 'user',
              content: 'What customer profile are we working with?',
            },
          ],
        },
        config
      );

      return {
        threadId,
        output: toPlainText(followUp.messages.at(-1)?.content),
      };
    },
    logger
  );
}

export async function runLangGraphRoutingExample({
  logger = defaultLogger,
  request = 'A customer needs a refund review',
} = {}) {
  return runLoggedStep(
    'langgraph.routing',
    async () => {
      const RoutingState = new StateSchema({
        request: z.string(),
        route: z.string().default(''),
        answer: z.string().default(''),
      });

      const classify = async (state) => {
        const route = state.request.toLowerCase().includes('refund') ? 'billing' : 'support';
        return { route };
      };

      const routeRequest = (state) => state.route;

      const billingNode = async () => ({
        answer: 'Send the request through the billing escalation workflow.',
      });

      const supportNode = async () => ({
        answer: 'Handle the request with the general support workflow.',
      });

      const graph = new StateGraph(RoutingState)
        .addNode('classify', classify)
        .addNode('billing', billingNode)
        .addNode('support', supportNode)
        .addEdge(START, 'classify')
        .addConditionalEdges('classify', routeRequest, ['billing', 'support'])
        .addEdge('billing', END)
        .addEdge('support', END)
        .compile();

      return graph.invoke({ request });
    },
    logger
  );
}

export async function runDeepAgentExample({
  logger = defaultLogger,
  model = createDefaultDeepAgentModel(),
  topic = 'refunds',
} = {}) {
  return runLoggedStep(
    'deepagents.smoke',
    async () => {
      const policyLookup = createPolicyLookupTool();
      const agent = createDeepAgent({
        model,
        tools: [policyLookup],
        systemPrompt:
          'You are a backend operations researcher. Use lookup_policy before answering policy questions.',
      });

      const result = await agent.invoke(
        {
          messages: [
            {
              role: 'user',
              content: `Summarize the ${topic} policy for the support team.`,
            },
          ],
        },
        {
          configurable: { thread_id: 'deep-agent-demo-thread' },
          recursionLimit: 6,
        }
      );

      return {
        output: toPlainText(result.messages.at(-1)?.content),
        messages: result.messages.length,
      };
    },
    logger
  );
}
