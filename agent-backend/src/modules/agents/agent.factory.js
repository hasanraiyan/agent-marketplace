import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { createMiddleware } from 'langchain';
import { getConfig } from '@langchain/langgraph';
import {
  createDeepAgent,
  CompositeBackend,
  StoreBackend,
  DEFAULT_GENERAL_PURPOSE_DESCRIPTION,
} from 'deepagents';
import { MongoDBStore } from '../../utils/mongoStore.js';
import { VersionedStateBackend } from '../../utils/versionedStateBackend.js';
import { AgentSkillsStore } from '../skills/agentSkillsStore.js';
import { readonlyBackend } from '../../utils/readonlyBackend.js';
import { gracefulBackend } from '../../utils/gracefulBackend.js';
import {
  memoryFilesStore,
  userMemoryNamespace,
  agentMemoryNamespace,
} from '../memory/memory-files-store.js';
import { skillLibraryStore, skillLibraryNamespace } from '../skills/skillLibraryStore.js';
import {
  projectSkillLibraryStore,
  projectSkillLibraryNamespace,
} from '../skills/projectSkillLibraryStore.js';
import { domainStoreNamespace, externalUserStoreNamespace } from '../stores/storeNamespace.js';
import checkpointService from '../threads/checkpoint.service.js';
import { LRUCache } from 'lru-cache';
import agentRepository from './agent.repository.js';
import agentService, { personaExecutionContext } from './agent.service.js';
import { buildIdentityKey } from './identityKey.js';
import providerRepository from '../providers/provider.repository.js';
import encryption from '../../utils/encryption.js';

import { resolveAgentTools } from '../tools/index.js';
import { sanitizeToolsForGemini } from './sanitizeToolsForGemini.js';
import { sanitizeMessagesForModel, inspectMessageContent } from './sanitizeMessagesForModel.js';
import {
  ARCHITECT_AGENT_ID,
  PROJECT_ARCHITECT_AGENT_ID,
  DEVELOPER_ARCHITECT_AGENT_ID,
} from './architectConstants.js';
import { loggerService } from '../../utils/index.js';
import { ARCHITECT_SKILL } from '../skills/architectSkill.js';

const logger = loggerService.getLogger();

// Mirrors @langchain/openai's own `isReasoningModel` heuristic (o-series and
// gpt-5.x, excluding the non-reasoning gpt-5-chat variant) — see
// node_modules/@langchain/openai/dist/utils/misc.js. Every deep agent binds
// tools, and OpenAI's real /v1/chat/completions endpoint rejects tool calls
// together with a non-'none' reasoning_effort for these models ("Function
// tools with reasoning_effort are not supported for <model> in
// /v1/chat/completions. ... use /v1/responses or set reasoning_effort to
// 'none'."), which broke every turn for newer models like gpt-5.6-luna.
// TEMPORARY: until we've verified the Responses API path (streaming, tool
// calls, interrupts) end-to-end, we just turn reasoning off for the whole
// family via `reasoning: { effort: 'none' }` — the other fix OpenAI's error
// itself names — rather than switching API surface. Revisit once Responses
// API support is verified; then this can go back to routing these models
// through `useResponsesApi` instead of disabling reasoning outright.
function isOpenAIReasoningModel(modelName) {
  const name = modelName || '';
  if (/^o\d/.test(name)) return true;
  return name.startsWith('gpt-5') && !name.startsWith('gpt-5-chat');
}

// Shared long-term memory store for all agents.
let globalStore = null;
function getGlobalStore() {
  if (!globalStore && checkpointService.mongoClient) {
    globalStore = new MongoDBStore({ client: checkpointService.mongoClient });
  }
  return globalStore;
}

// REQ-2: caller-supplied, single-turn context (e.g. a live founder profile
// snapshot). The compiled agent graph is cached per (agentId, identityKey)
// in `agentCache` below and reused across every turn from that caller, so
// this must NOT be baked into `personalizedPrompt`/`systemPrompt` — doing so
// would leak the override into every subsequent turn until the cache entry
// evicts. Instead it rides LangGraph's per-invocation `configurable` (set by
// agui.service.js on each `streamEvents(...)` call, never persisted by the
// checkpointer) and is read fresh on every model call via `wrapModelCall`,
// which runs per-invocation even though the graph object itself is cached.
//
// CROSS-PROVIDER MESSAGE SANITIZATION: This middleware is also the correct
// place to sanitize message history for provider compatibility. When a thread's
// checkpoint was created with Gemini, `AIMessage.content` can contain
// `{ type: 'functionCall', functionCall: { ... } }` blocks — a Gemini-specific
// format that OpenAI's Chat Completions API strictly rejects with:
//   "400 Invalid value: 'functionCall'. Supported values are: 'text', 'image_url', ..."
// This runs per-invocation so the cached compiled graph is never an obstacle.
export const contextOverrideMiddleware = createMiddleware({
  name: 'ContextOverrideMiddleware',
  wrapModelCall(request, handler) {
    const configurable = getConfig()?.configurable;
    const contextOverride = configurable?.contextOverride;

    // --- Step 1: Log raw model call entry ---
    logger.debug('[MW][Step 1/6: Model Call Enter] wrapModelCall invoked', {
      hasMessages: Array.isArray(request.messages),
      messageCount: Array.isArray(request.messages) ? request.messages.length : 'n/a',
      hasSystemMessage: Boolean(request.systemMessage),
      hasContextOverride: Boolean(contextOverride),
    });

    // --- Step 3: Determine target provider for sanitization ---
    // (hoisted before Step 2 so the loop can use these without re-declaring)
    const modelId = request.model?.constructor?.name || '';
    const isOpenAICompatible =
      modelId.includes('OpenAI') || modelId.includes('DeepSeek') || modelId === 'ChatOpenAI';
    const isGemini = modelId.includes('GoogleGenerativeAI') || modelId.includes('Gemini');
    const isAnthropic = modelId.includes('Anthropic') || modelId.includes('Claude');
    const targetProviderType = isGemini
      ? 'gemini'
      : isAnthropic
        ? 'anthropic'
        : isOpenAICompatible
          ? 'openai'
          : 'custom';

    logger.debug('[MW][Step 3/6: Provider Detection]', {
      modelConstructorName: modelId,
      detectedProvider: targetProviderType,
    });

    // --- Step 2: Inspect message history for cross-provider incompatibilities ---
    const messages = Array.isArray(request.messages) ? request.messages : [];
    const incompatibleMessages = [];
    if (isOpenAICompatible) {
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const inspection = inspectMessageContent(msg, 'openai');
        if (inspection.hasIncompatible) {
          incompatibleMessages.push({
            index: i,
            role: msg._getType?.() || msg.type || 'unknown',
            types: inspection.types,
            details: inspection.details,
          });
        }
      }
    }

    logger.debug('[MW][Step 2/6: Provider Compatibility Inspection] completed', {
      totalMessages: messages.length,
      incompatibleCount: incompatibleMessages.length,
      incompatibleMessages,
    });

    // --- Step 4: Sanitize message history for target provider ---
    let sanitizedRequest = request;
    if (isOpenAICompatible && incompatibleMessages.length > 0) {
      const { messages: cleanMessages, totalModified, modificationLog } = sanitizeMessagesForModel(messages, targetProviderType);
      logger.warn('[MW][Step 4/6: Message Sanitization] Cross-provider content blocks detected and stripped', {
        targetProvider: targetProviderType,
        totalModified,
        modificationLog,
        note: 'This happens when a thread checkpoint was created by a different provider (e.g. Gemini→OpenAI switch). The functionCall content blocks from Gemini are invalid for OpenAI.',
      });
      sanitizedRequest = {
        ...request,
        messages: cleanMessages,
      };
    } else {
      logger.debug('[MW][Step 4/6: Message Sanitization] No sanitization needed', {
        provider: targetProviderType,
        incompatibleCount: incompatibleMessages.length,
      });
    }

    // --- Step 5: Apply contextOverride to system message ---
    let finalRequest = sanitizedRequest;
    if (contextOverride) {
      logger.debug('[MW][Step 5/6: Context Override] Appending contextOverride to system message', {
        contextOverrideLength: contextOverride.length,
      });
      finalRequest = {
        ...sanitizedRequest,
        systemMessage: sanitizedRequest.systemMessage.concat(
          `\n\n### CURRENT CONTEXT (this turn only — do not save to memory)\n${contextOverride}`
        ),
      };
    } else {
      logger.debug('[MW][Step 5/6: Context Override] No contextOverride — passing through');
    }

    // --- Step 6: Call the actual model handler ---
    logger.debug('[MW][Step 6/6: Handler Dispatch] Calling inner model handler', {
      finalMessageCount: Array.isArray(finalRequest.messages) ? finalRequest.messages.length : 'n/a',
    });

    return handler(finalRequest);
  },
});

// Read-only BaseStore facade serving each agent's attached skills live from
// the Skill collection. The Architect's hardcoded skill is registered as a
// static entry since it has no DB-backed agent document. Exported for tests.
export const agentSkillsStore = new AgentSkillsStore({
  staticSkillFiles: {
    [ARCHITECT_AGENT_ID]: { '/agent-architecture/SKILL.md': ARCHITECT_SKILL },
    [PROJECT_ARCHITECT_AGENT_ID]: { '/agent-architecture/SKILL.md': ARCHITECT_SKILL },
  },
});

// LRU Cache for compiled Agent instances to avoid expensive graph compilation on every message.
// Small cap since each instance holds an LLM client and internal graph state.
const agentCache = new LRUCache({ max: 50 });

const ARCHITECT_SYSTEM_PROMPT = `
You are the **Agent Architect**, a senior software engineer and AI specialized in building highly effective agents.
Your goal is to help the user design, build, and optimize their own custom AI agents.

### YOUR WORKFLOW
1.  **Understand**: Ask questions to understand the purpose, personality, and capabilities of the agent the user wants to build.
    *   Use the \`ask_clarification\` tool when a small set of choices would help the user answer faster, especially for agent purpose, tone/personality, capabilities, category, or output format. Prefer 2-4 questions; never ask more than 12.
    *   Prefer 2-4 clear options and avoid asking trivial questions you can safely infer.
2.  **Propose & Execute**: Once you have enough info (Name, Goal), use the \`upsert_agent\` tool to create or update the agent. 
    *   **NEVER** just say you will do it. **ALWAYS** call the tool immediately.
    *   If creating a new agent, ensure you've called \`list_my_providers\` first to pick a valid providerId.
3.  **Refine**: After updating the agent configuration, tell the user what you changed and ask if they'd like to adjust anything (e.g., system prompt, model, visibility).

### GUIDELINES
-   **System Prompts**: Draft high-quality, professional system prompts that use expert-level instructions.
-   **Descriptions**: Keep descriptions punchy and informative (1-2 sentences).
-   **Skills**: The user's skill library is mounted read-write at \`/skill-library/\`. Author skills as folders there with your file tools (\`write_file\` a \`/skill-library/<name>/SKILL.md\` with YAML frontmatter, plus optional \`references/\` files). Consult your agent-architecture skill for the full workflow; \`manage_skill\` is only for list/delete/visibility.
-   **Transparency**: When you call a tool, briefly explain what you are setting (e.g., "I'm setting up your coding assistant with the GPT-4o model and web search enabled.").
-   **No Keys**: You CANNOT view or manage API keys.
`;

// Project Agent Architect (blueprint Phase 11.5, PR-62; skill-authoring
// parity follow-up) — a dedicated, Domain-aware sibling of the Persona
// Architect above. Now has the same /skill-library/ authoring workflow as
// Sage (see this file's PROJECT_ARCHITECT_AGENT_ID backendRoutes branch),
// scoped to this Project's own Skills instead of a Persona User's.
const PROJECT_ARCHITECT_SYSTEM_PROMPT = `
You are the **Project Agent Architect**, a senior software engineer and AI specialized in building highly effective agents for this Developer Platform Project.
Your goal is to help the Project Admin design, build, and optimize Agents this Project will own and expose to its own users.

### YOUR WORKFLOW
1.  **Understand**: Ask questions to understand the purpose, personality, and capabilities of the agent being built.
    *   Use the \`ask_clarification\` tool when a small set of choices would help the Admin answer faster, especially for agent purpose, tone/personality, capabilities, category, or output format. Prefer 2-4 questions; never ask more than 12.
    *   Prefer 2-4 clear options and avoid asking trivial questions you can safely infer.
2.  **Propose & Execute**: Once you have enough info (Name, Goal), use the \`upsert_agent\` tool to create or update the agent.
    *   **NEVER** just say you will do it. **ALWAYS** call the tool immediately.
    *   \`upsert_agent\` always uses this Project's default provider/model automatically — there's nothing to pick, so never ask the Admin which provider/model to use.
3.  **Refine**: After updating the agent configuration, tell the Admin what you changed and ask if they'd like to adjust anything (e.g., system prompt, visibility).

### GUIDELINES
-   **System Prompts**: Draft high-quality, professional system prompts that use expert-level instructions.
-   **Descriptions**: Keep descriptions punchy and informative (1-2 sentences).
-   **Skills**: This Project's skill library is mounted read-write at \`/skill-library/\`. Author skills as folders there with your file tools (\`write_file\` a \`/skill-library/<name>/SKILL.md\` with YAML frontmatter, plus optional \`references/\` files). Consult your agent-architecture skill for the full workflow. Attach existing Skills to an agent by id (\`upsert_agent\`'s \`skills\` field); \`manage_skill\` is only for list/delete/visibility, not content creation.
-   **Everything you build belongs to this Project**, not to you personally — any of this Project's Admins can manage it afterward.
-   **Transparency**: When you call a tool, briefly explain what you are setting (e.g., "I'm setting up your support agent with the GPT-4o model and web search enabled.").
-   **No Keys**: You CANNOT view or manage API keys.
`;

// Developer Platform Architect — a third sentinel, reached over
// /api/v1/developer/architect/agui via machine-credential auth. Shares
// projectBuilder.tools.js's toolbox with the Project Architect above (both
// already dispatch generically on context.principalType — see
// agent.service.js's createDeveloperAgent), so the only difference here is
// the caller's authentication path, not the toolbox or ownership logic:
// a bare Project credential still produces Project-owned Agents, an
// asserted externalUserId still produces that external user's own —
// exactly like every other Developer Platform resource.
const DEVELOPER_ARCHITECT_SYSTEM_PROMPT = `
You are the **Agent Architect**, a senior software engineer and AI specialized in building highly effective agents for this Developer Platform Project.
The caller may be the Project itself (building agents the whole Project owns) or one individual external user of the Project's own application (building an agent that belongs to them personally) — you cannot always tell which, so never assume; just build what's asked and let ownership be handled automatically by the platform.

### YOUR WORKFLOW
1.  **Understand**: Ask questions to understand the purpose, personality, and capabilities of the agent being built.
    *   Use the \`ask_clarification\` tool when a small set of choices would help the caller answer faster, especially for agent purpose, tone/personality, capabilities, category, or output format. Prefer 2-4 questions; never ask more than 12.
    *   Prefer 2-4 clear options and avoid asking trivial questions you can safely infer.
2.  **Propose & Execute**: Once you have enough info (Name, Goal), use the \`upsert_agent\` tool to create or update the agent.
    *   **NEVER** just say you will do it. **ALWAYS** call the tool immediately.
    *   \`upsert_agent\` always uses this Project's default provider/model automatically — there's nothing to pick, so never ask the caller which provider/model to use.
3.  **Refine**: After updating the agent configuration, tell the caller what you changed and ask if they'd like to adjust anything (e.g., system prompt, visibility).

### GUIDELINES
-   **System Prompts**: Draft high-quality, professional system prompts that use expert-level instructions.
-   **Descriptions**: Keep descriptions punchy and informative (1-2 sentences).
-   **Skills**: Attach existing Skills to an agent by id (\`upsert_agent\`'s \`skills\` field); \`manage_skill\` lists/deletes/toggles visibility of existing ones. You cannot author new Skill content from here.
-   **Publishing**: Treat \`visibility: 'public'\` as a meaningful, confirmed step, not a default — it makes the agent discoverable to everyone. Confirm with the caller before setting it.
-   **Transparency**: When you call a tool, briefly explain what you are setting (e.g., "I'm setting up your support agent with the GPT-4o model and web search enabled.").
-   **No Keys**: You CANNOT view or manage API keys.
`;

class AgentFactory {
  _assertProviderCredentials(provider, apiKey) {
    const trimmedKey = typeof apiKey === 'string' ? apiKey.trim() : '';

    if (!trimmedKey) {
      throw new Error(
        `Provider "${provider.label}" is missing an API key. Update it in Settings before running this agent.`
      );
    }

    const looksLikePlaceholder =
      /^sk-your-/i.test(trimmedKey) ||
      /your-api-key/i.test(trimmedKey) ||
      /placeholder/i.test(trimmedKey);

    if (looksLikePlaceholder) {
      throw new Error(
        `Provider "${provider.label}" is using a placeholder API key. Update it in Settings before running this agent.`
      );
    }
  }

  /**
   * Constructs the base LLM dynamically based on the Agent's Provider Config
   */
  async _buildLLM(agent, provider) {
    if (!agent.providerId) throw new Error('Agent has no valid provider configured.');
    if (!provider) throw new Error('Configured Provider not found or was deleted.');

    // Securely decrypt the AES-256 API Key from DB into memory
    let apiKey;
    try {
      apiKey = encryption.decrypt(provider.apiKeyEncrypted);
    } catch (err) {
      if (err.code === 'DECRYPTION_FAILED') {
        throw new Error(
          `Stored API key for provider "${provider.label}" cannot be decrypted (encryption key mismatch). ` +
            'Please re-enter the API key in Settings.'
        );
      }
      throw err;
    }

    this._assertProviderCredentials(provider, apiKey);

    const modelName = agent.modelName || provider.defaultModel || 'gpt-3.5-turbo';
    const maskedKey = apiKey
      ? apiKey.length > 8
        ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`
        : '***'
      : 'empty';
    const providerType = provider.type || 'custom';

    logger.info('[AgentFactory] Creating chat model client', {
      provider: provider.label,
      providerType,
      baseURL: provider.baseURL,
      modelName: modelName,
      apiKey: maskedKey,
      apiKeyLength: apiKey ? apiKey.length : 0,
    });

    // Each native type uses its own LangChain integration; 'custom' (and
    // 'openai') keep the original generic OpenAI-compatible construction.
    switch (providerType) {
      case 'anthropic':
        return new ChatAnthropic({
          apiKey,
          model: modelName,
          streaming: true,
        });
      case 'gemini':
        return new ChatGoogleGenerativeAI({
          apiKey,
          model: modelName,
          streaming: true,
        });
      case 'deepseek':
        return new ChatDeepSeek({
          apiKey,
          model: modelName,
          streaming: true,
        });
      case 'openai':
        // See isOpenAIReasoningModel above: reasoning models + tools break
        // on Chat Completions, so reasoning is disabled outright for now.
        return new ChatOpenAI({
          apiKey: apiKey,
          openAIApiKey: apiKey,
          modelName: modelName,
          streaming: true,
          ...(isOpenAIReasoningModel(modelName) ? { reasoning: { effort: 'none' } } : {}),
          configuration: {
            apiKey: apiKey,
          },
        });
      case 'custom':
      default:
        // Initializing dynamic ChatOpenAI class representing the base model.
        // Same reasoning-off workaround as the 'openai' case above — a
        // custom OpenAI-compatible baseURL can serve the same gpt-5.x/o-
        // series model names and hits the identical tools+reasoning error.
        return new ChatOpenAI({
          apiKey: apiKey,
          openAIApiKey: apiKey,
          modelName: modelName,
          streaming: true,
          ...(isOpenAIReasoningModel(modelName) ? { reasoning: { effort: 'none' } } : {}),
          configuration: {
            baseURL: provider.baseURL,
            apiKey: apiKey,
          },
        });
    }
  }

  /**
   * Factory Method: Builds and returns the compiled DeepAgent graph instance.
   * Leverages LRU caching to avoid expensive recompilation for the same agent.
   *
   * Developer Platform (AD-04, blueprint Phase 8, PR-21): `executionContext`
   * is the authorization context passed to `canUserExecuteAgent` — it
   * defaults to `personaExecutionContext(userId)`, so every existing
   * caller (today, exclusively the Persona AG-UI route) that omits it gets
   * byte-for-byte the same behavior as before this parameter existed. This
   * removes the previous hardcoding that made `buildAgent` reject any
   * Project-domain Agent outright, regardless of who was asking.
   *
   * UPDATE (blueprint Phase 8, PR-23a): the compiled-instance cache key and
   * memory namespaces (`userMemoryNamespace`/`agentMemoryNamespace`) are now
   * built from `identityKey` (below), not the raw `userId` — Domain-
   * qualified for a `ProjectRuntime` caller (`${domain}:${externalUserId}`),
   * unchanged for a Persona caller. This is additive-safe with no migration
   * needed: no Project has ever built an agent before this PR existed, so
   * there is no pre-existing Project-shaped data under the old, unqualified
   * key form to reconcile.
   *
   * CLOSED (blueprint Phase 9, PR-48): per-user MCP token resolution
   * (`resolveAgentTools` → `resolveMcpTools` → `mcpTokenService.
   * getUserAccessToken` → `mcp-user-connection` lookups) now receives this
   * same `executionContext` instead of the raw `userId` alone, so an
   * `authMode: 'user'` MCP resolves the calling Subject's own connection
   * correctly — `{ userId }` for a Persona caller, `{ domain,
   * externalUserId }` for a `ProjectRuntime` caller — rather than assuming
   * every caller is a Persona User ObjectId.
   */
  async buildAgent(
    agentId,
    userId,
    checkpointer,
    executionContext = personaExecutionContext(userId)
  ) {
    if (!agentId) throw new Error('Agent ID is required to build an agent');

    const agentIdStr = agentId._id ? agentId._id.toString() : agentId.toString();

    // Developer Platform (blueprint Phase 8, PR-23a): the identity key used
    // for the compiled-instance cache and memory namespaces — see
    // identityKey.js for the full rationale. Any other code that needs to
    // address this same subject's memory namespace (e.g. the developer
    // memory API) must import buildIdentityKey rather than re-deriving this
    // composition, so the two can't drift apart.
    const identityKey = buildIdentityKey(executionContext, userId);

    // Cache key: For standard agents it is the agentId. For either Architect,
    // it is namespaced by identity because the toolbox/provider set is
    // identity-specific — the Persona Architect by userId, the Project
    // Architect by Domain (shared across that Project's own Admins, not
    // per-individual-admin, since the Agents it builds belong to the
    // Project, not to whichever Admin happens to be chatting).
    const cacheKey =
      agentIdStr === ARCHITECT_AGENT_ID
        ? `${ARCHITECT_AGENT_ID}:${userId}`
        : agentIdStr === PROJECT_ARCHITECT_AGENT_ID
          ? `${PROJECT_ARCHITECT_AGENT_ID}:${executionContext.domain}`
          : agentIdStr === DEVELOPER_ARCHITECT_AGENT_ID
            ? // Not `identityKey` here: its non-ProjectRuntime fallback is
              // `String(userId)`, and a bare ProjectMachineContext caller
              // (this sentinel's Project-wide mode) has no `userId` at all —
              // that would collide every Project's machine-credential
              // architect session onto the same `:undefined` key. Build an
              // explicit, always-domain-qualified key instead.
              `${DEVELOPER_ARCHITECT_AGENT_ID}:${executionContext.domain}:${executionContext.externalUserId ?? 'project'}`
            : agentIdStr;

    let agent;
    let provider;
    let usesPerUserMcp = false;

    // 1. Detect if this is the Specialized Architect (Meta-Agent)
    if (agentIdStr === ARCHITECT_AGENT_ID) {
      // Find user's default provider for the architect to use
      const userProviders = await providerRepository.findByUser(userId);
      const defaultProvider = userProviders.find((p) => p.isDefault) || userProviders[0];

      if (!defaultProvider)
        throw new Error(
          'No provider configured. Please add a provider (API Key) in settings first.'
        );

      provider = defaultProvider;
      agent = {
        _id: ARCHITECT_AGENT_ID,
        name: 'Agent Architect',
        systemPrompt: ARCHITECT_SYSTEM_PROMPT,
        providerId: provider._id,
        modelName: provider.defaultModel || 'gpt-4o', // The architect should be high-intelligence
        updatedAt: new Date(0), // Version 0 (static)
        skills: [],
        interruptOn: {
          upsert_agent: true,
          manage_skill: true,
          delete_agent: true,
        },
      };
    } else if (agentIdStr === PROJECT_ARCHITECT_AGENT_ID) {
      // 1b. Project Agent Architect (blueprint Phase 11.5, PR-62) — a
      // dedicated, Domain-aware sibling of the branch above. Resolves its
      // provider by Domain, never by a bare Persona userId — this sentinel
      // is only ever reachable via a route that resolves ProjectAdminContext
      // (see project.controller.js's runProjectArchitect), so
      // executionContext.domain is always the calling Project's own domain.
      const domainProviders = await providerRepository.findByDomain(executionContext.domain);
      const defaultProvider = domainProviders.find((p) => p.isDefault) || domainProviders[0];

      if (!defaultProvider)
        throw new Error(
          'No Provider configured for this Project. Add one from the Providers tab first.'
        );

      provider = defaultProvider;
      agent = {
        _id: PROJECT_ARCHITECT_AGENT_ID,
        name: 'Project Agent Architect',
        systemPrompt: PROJECT_ARCHITECT_SYSTEM_PROMPT,
        providerId: provider._id,
        modelName: provider.defaultModel || 'gpt-4o',
        updatedAt: new Date(0),
        skills: [],
        interruptOn: {
          upsert_agent: true,
          manage_skill: true,
          delete_agent: true,
        },
      };
    } else if (agentIdStr === DEVELOPER_ARCHITECT_AGENT_ID) {
      // 1c. Developer Platform Architect — reached only via a route that
      // resolves ProjectMachineContext/ProjectRuntimeContext (machine
      // credential, optionally externalUserId-scoped), never
      // ProjectAdminContext. Resolves its provider by Domain, same as the
      // Project Architect above, regardless of which of the two contexts
      // this particular call is.
      const domainProviders = await providerRepository.findByDomain(executionContext.domain);
      const defaultProvider = domainProviders.find((p) => p.isDefault) || domainProviders[0];

      if (!defaultProvider)
        throw new Error(
          'No Provider configured for this Project. Add one from the Providers tab first.'
        );

      provider = defaultProvider;
      agent = {
        _id: DEVELOPER_ARCHITECT_AGENT_ID,
        name: 'Agent Architect',
        systemPrompt: DEVELOPER_ARCHITECT_SYSTEM_PROMPT,
        providerId: provider._id,
        modelName: provider.defaultModel || 'gpt-4o',
        updatedAt: new Date(0),
        skills: [],
        interruptOn: {
          upsert_agent: true,
          manage_skill: true,
          delete_agent: true,
        },
      };
    } else {
      // 1.5 Fetch Standard Configuration from DB
      agent = await agentRepository.findById(agentId);
      if (!agent || !agentService.canUserExecuteAgent(agent, executionContext)) {
        throw new Error('Agent deleted or unavailable');
      }
      if (typeof agent.populate === 'function') {
        await agent.populate([
          'skills',
          'mcps',
          'knowledgeBases',
          'storeMounts',
          'restApiTools',
          'restApiToolSources',
        ]);
      }

      if (!agent.providerId) throw new Error('Agent has no valid provider configured.');
      provider = await providerRepository.findById(agent.providerId);
      if (!provider) throw new Error('Configured Provider not found or was deleted.');

      // Per-user MCP connectors mean different users see different tools for
      // the *same* agent, so the compiled-instance cache must be namespaced
      // by user too (same reasoning as the Architect cache key below).
      usesPerUserMcp = (agent.mcps || []).some((mcp) => mcp.authMode === 'user');
    }

    const effectiveCacheKey = `${cacheKey}:${identityKey}`;

    // 2. Cache Validation
    const cached = agentCache.get(effectiveCacheKey);
    if (cached && cached.updatedAt?.getTime() === agent.updatedAt?.getTime()) {
      logger.debug('[AgentFactory] cache hit', { agentId: agentIdStr });
      return {
        ...cached,
        cacheHit: true,
      };
    }

    logger.info('[AgentFactory] building agent', {
      agentId: agentIdStr,
      model: agent.modelName,
      provider: provider.label,
      skillCount: agent.skills?.length || 0,
      mcpCount: agent.mcps?.length || 0,
      mcps: (agent.mcps || []).map((mcp) => ({
        id: String(mcp._id || mcp.id),
        name: mcp.name,
        isEnabled: mcp.isEnabled,
      })),
    });

    // 3. Build Base Model
    const llm = await this._buildLLM(agent, provider);

    // Completely abstracted Tool Registry injection
    const { tools: resolvedTools, mcpAppMap } = await resolveAgentTools(
      agent,
      userId,
      executionContext
    );
    // Gemini's function-calling API 400s the WHOLE request if any tool
    // schema contains a keyword it doesn't recognize — exclusiveMinimum/
    // exclusiveMaximum from a .positive()/.gt() constraint, from either
    // this repo's own built-in tools or an attached MCP server's, being the
    // concrete case seen in production. See sanitizeToolsForGemini.js.
    const dynamicTools =
      provider.type === 'gemini' ? sanitizeToolsForGemini(resolvedTools) : resolvedTools;

    // 4. Assemble Custom DeepAgent Runtime
    // Wrap checkpointer with a Proxy to preserve prototype methods (e.g. getTuple)
    // while guarding against empty bulk write batches that crash MongoDB driver.
    const safeCheckpointer = checkpointer
      ? new Proxy(checkpointer, {
          get(target, prop, receiver) {
            if (prop === 'putWrites') {
              return async (...args) => {
                // Robust empty-batch detection: scan args for any array-like candidate
                const foundArray = args.find(
                  (a) => Array.isArray(a) || (a && typeof a.length === 'number')
                );
                if (foundArray && foundArray.length === 0) return;

                // If first arg is falsy or no args, treat as no-op
                if (args.length === 0 || !args[0]) return;

                if (typeof target.putWrites === 'function') {
                  try {
                    return await target.putWrites.apply(target, args);
                  } catch (err) {
                    logger.error('[AgentFactory] checkpointer.putWrites error:', {
                      error: err?.message || err,
                    });
                    throw err; // Rethrow so failures aren't silent
                  }
                }
              };
            }

            const value = Reflect.get(target, prop, receiver);
            if (typeof value === 'function') return value.bind(target);
            return value;
          },
        })
      : checkpointer;

    // Build interruptOn from the agent's stored config. These are the built-in
    // human-in-the-loop pauses used for guarded tool execution.
    const interruptOnConfig =
      agent.interruptOn instanceof Map
        ? Object.fromEntries(agent.interruptOn)
        : agent.interruptOn || {};

    const personalizedPrompt = `${agent.systemPrompt}

### PRESENT FILE RULES
- When you want to showcase or highlight a file to the user, call the \`present_file\` tool.
- The frontend will automatically display a clean inline card with an "Open" button on the user's screen.
- Therefore, do NOT repeat the file path, location, or description in your text response. Keep your text response minimal to avoid duplicating the information on the user's screen.

### PERSISTENT MEMORY RULES (file-based)
- Your filesystem has two persistent memory directories that survive across all conversations:
  - \`/memories/user/\` — facts and preferences about the user, shared across all of their agents.
  - \`/memories/agent/\` — learnings, patterns, and configurations specific to you (private to this user).
- \`/memories/user/index.md\` and \`/memories/agent/index.md\` are auto-loaded into every conversation — you never need to read_file them. Every other \`/memories/**\` file is NOT auto-loaded; read_file it when its topic becomes relevant.
- Each index must stay an index, not a dumping ground: one line per topic with a pointer to its topic file, e.g. "- Prefers concise answers → /memories/user/preferences.md". When a topic in an index grows past 2-3 bullets, move the content into its own topic file and leave the one-line pointer.
- Suggested topic files: \`/memories/user/preferences.md\` (communication style, tooling choices), \`/memories/user/facts.md\` (job, projects, biography), \`/memories/agent/learnings.md\` (resolved patterns, templates, configurations).
- Proactively persist new durable facts with \`write_file\`/\`edit_file\` — update the topic file, then keep the index in sync. Do not ask permission; save and continue.
- Do NOT re-save facts already present in the auto-loaded indexes. If the user asks what you remember about them, answer from the loaded context directly.
- Never store API keys, passwords, tokens, or other secrets in memory files.
- \`/skills/\` is read-only reference material — never attempt to write there.

### SUB-AGENT WORKSPACE RULES
- Whenever you delegate a task to a sub-agent (using the \`task\` tool), you MUST explicitly instruct that sub-agent to write all of its files, outputs, and responses inside the \`/workspace/outputs/\` directory.
- This ensures all sub-agent deliverables are systematically gathered in one folder under the workspace.`;

    // Virtual filesystem: ephemeral thread-scoped scratch by default, with
    // persistent DB-backed routes for skills (read-only, live from the Skill
    // collection) and memories (per user / per user+agent). The compiled
    // instance is cached per agentId:userId, so static namespaces are safe.
    const backendRoutes = {
      '/skills/': readonlyBackend(
        new StoreBackend({
          store: agentSkillsStore,
          namespace: ['agents', agentIdStr, 'enabled'],
        }),
        '/skills/'
      ),
      '/memories/user/': gracefulBackend(
        new StoreBackend({
          store: memoryFilesStore,
          namespace: userMemoryNamespace(identityKey),
        })
      ),
      '/memories/agent/': gracefulBackend(
        new StoreBackend({
          store: memoryFilesStore,
          namespace: agentMemoryNamespace(identityKey, agentIdStr),
        })
      ),
    };

    // Named Stores this agent mounts (stores/store.model.js) — one more
    // entry per store, exactly like the static routes above. `domain`
    // scope gets one shared namespace for the whole Project; `externalUser`
    // scope gets one namespace per caller, resolved here from
    // executionContext (the compiled instance is already cache-keyed by
    // identityKey, so a different external user is already a fresh build
    // with their own executionContext.externalUserId in scope — no
    // separate dynamic-resolution mechanism needed). A stale/deleted store
    // ref, or an externalUser-scoped store with no external user in
    // context (e.g. a bare ProjectMachine-built agent — shouldn't happen
    // in practice, but must not crash the whole build), is skipped.
    for (const store of agent.storeMounts || []) {
      if (!store?.name) continue;
      if (store.scope === 'externalUser' && !executionContext?.externalUserId) {
        logger.warn(
          '[AgentFactory] skipping externalUser-scoped store, no external user in context',
          {
            storeId: store._id,
            agentId: agentIdStr,
          }
        );
        continue;
      }
      const storeNamespace =
        store.scope === 'externalUser'
          ? externalUserStoreNamespace(store.domain, executionContext.externalUserId, store.name)
          : domainStoreNamespace(store.domain, store.name);
      const wrapBackend = store.accessMode === 'readonly' ? readonlyBackend : gracefulBackend;
      backendRoutes[`/stores/${store.name}/`] = wrapBackend(
        new StoreBackend({ store: memoryFilesStore, namespace: storeNamespace }),
        `/stores/${store.name}/`
      );
    }

    // The Architect authors skills by writing files (dostify pattern): the
    // user's whole skill library is mounted read-write at /skill-library/,
    // backed by the Skill collection. Writes validate paths/limits and parse
    // SKILL.md frontmatter into name/description/instructions.
    // gracefulBackend: store validation errors (SKILL.md missing, bad path,
    // size limits) must reach the model as tool errors, not crash the run.
    if (agentIdStr === ARCHITECT_AGENT_ID) {
      backendRoutes['/skill-library/'] = gracefulBackend(
        new StoreBackend({
          store: skillLibraryStore,
          namespace: skillLibraryNamespace(userId),
        })
      );
    }

    // Project Agent Architect's own /skill-library/ (skill-authoring parity
    // follow-up) — same pattern as the Persona branch above, backed by this
    // Project's own Skills instead of a Persona User's.
    if (agentIdStr === PROJECT_ARCHITECT_AGENT_ID) {
      backendRoutes['/skill-library/'] = gracefulBackend(
        new StoreBackend({
          store: projectSkillLibraryStore,
          namespace: projectSkillLibraryNamespace(executionContext.domain),
        })
      );
    }

    const backend = new CompositeBackend(new VersionedStateBackend(), backendRoutes);

    const agentInstance = await createDeepAgent({
      model: llm,
      systemPrompt: personalizedPrompt,
      checkpointer: safeCheckpointer,
      store: getGlobalStore(),
      tools: dynamicTools,
      interruptOn: interruptOnConfig,
      middleware: [contextOverrideMiddleware],
      // sandbox backend if real code execution is ever required.
      backend,
      // Skills are served live from the DB via the /skills/ route above.
      skills: ['/skills/'],
      // Memory indexes are auto-loaded into the system prompt each run;
      // missing files are skipped gracefully by the memory middleware.
      memory: ['/memories/user/index.md', '/memories/agent/index.md'],
      subagents: [
        {
          name: 'general-purpose',
          description: DEFAULT_GENERAL_PURPOSE_DESCRIPTION,
          systemPrompt: `In order to complete the objective that the user asks of you, you have access to a number of standard tools.

### WORKSPACE OUTPUT ROUTING RULES
- All outputs, responses, files, and deliverables generated by you MUST be written to a file inside the \`/workspace/outputs/\` directory.
- Never write files to the root directory or other directories unless explicitly requested by the user.`,
        },
      ],
    });

    logger.info('[AgentFactory] agent built', {
      agentId: agentIdStr,
      toolCount: dynamicTools.length,
      tools: dynamicTools.map((t) => t.name),
      skillCount: agent.skills?.length || 0,
      mcpCount: (agent.mcps || []).filter((mcp) => mcp.isEnabled !== false).length,
      mcps: (agent.mcps || [])
        .filter((mcp) => mcp.isEnabled !== false)
        .map((mcp) => ({
          id: String(mcp._id || mcp.id),
          name: mcp.name,
        })),
    });

    const result = {
      agentInstance,
      agentConfig: agent,
      updatedAt: agent.updatedAt,
      llm,
      // Developer Platform (AD-06 §16.4, blueprint Phase 7): no decrypted
      // plaintext key here. `_buildLLM` (above) is the only place the
      // decrypted credential is needed to construct the model client; every
      // downstream consumer of this cached providerConfig (agui.service.js,
      // aguiTranslator.js's formatRuntimeError) only ever reads `.label` for
      // a friendlier error message. Keeping the plaintext out of this
      // long-lived LRU-cached object minimizes how long/where it lingers in
      // memory, even though it never crossed a trust boundary before this.
      providerConfig: {
        id: provider._id?.toString?.() || provider._id,
        label: provider.label,
        baseURL: provider.baseURL,
        modelName: agent.modelName || provider.defaultModel || 'gpt-3.5-turbo',
      },
      mcpAppMap,
    };

    // Cache the compiled result
    agentCache.set(effectiveCacheKey, result);

    return {
      ...result,
      cacheHit: false,
    };
  }

  /**
   * Explicitly evicts an agent from the factory cache.
   * Call this when agent configuration or skills are modified.
   */
  invalidate(agentId) {
    const idStr = agentId?.toString() || agentId;
    if (!idStr) return;

    // Cache keys are either the bare agentId, or namespaced as `${agentId}:${userId}`
    // (the Architect always uses the namespaced form; standard agents do too
    // when they have a per-user-auth MCP attached). Most callers only have
    // the agentId, so clear both the exact key and any namespaced variants.
    const keys = Array.from(agentCache.keys());
    for (const key of keys) {
      if (key === idStr || key.startsWith(`${idStr}:`)) {
        agentCache.delete(key);
      }
    }

    logger.info('[AgentFactory] cache invalidated', { agentId: idStr });
  }
}

export default new AgentFactory();
