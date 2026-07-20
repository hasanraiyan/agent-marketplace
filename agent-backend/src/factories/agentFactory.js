import { ChatOpenAI } from '@langchain/openai';
import {
  createDeepAgent,
  CompositeBackend,
  StoreBackend,
  DEFAULT_GENERAL_PURPOSE_DESCRIPTION,
} from 'deepagents';
import { MongoDBStore } from '../utils/mongoStore.js';
import { VersionedStateBackend } from '../utils/versionedStateBackend.js';
import { AgentSkillsStore } from '../utils/agentSkillsStore.js';
import { readonlyBackend } from '../utils/readonlyBackend.js';
import { gracefulBackend } from '../utils/gracefulBackend.js';
import {
  memoryFilesStore,
  userMemoryNamespace,
  agentMemoryNamespace,
} from '../utils/memoryFilesStore.js';
import { skillLibraryStore, skillLibraryNamespace } from '../utils/skillLibraryStore.js';
import checkpointService from '../services/checkpoint.service.js';
import { LRUCache } from 'lru-cache';
import agentRepository from '../repositories/agentRepository.js';
import providerRepository from '../modules/providers/provider.repository.js';
import encryption from '../utils/encryption.js';

import { resolveAgentTools } from '../tools/index.js';
import { ARCHITECT_AGENT_ID } from '../utils/architectConstants.js';
import { loggerService } from '../utils/index.js';
import { ARCHITECT_SKILL } from '../skills/architectSkill.js';

const logger = loggerService.getLogger();

// Shared long-term memory store for all agents.
let globalStore = null;
function getGlobalStore() {
  if (!globalStore && checkpointService.mongoClient) {
    globalStore = new MongoDBStore({ client: checkpointService.mongoClient });
  }
  return globalStore;
}

// Read-only BaseStore facade serving each agent's attached skills live from
// the Skill collection. The Architect's hardcoded skill is registered as a
// static entry since it has no DB-backed agent document. Exported for tests.
export const agentSkillsStore = new AgentSkillsStore({
  staticSkillFiles: {
    [ARCHITECT_AGENT_ID]: { '/agent-architecture/SKILL.md': ARCHITECT_SKILL },
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

    logger.info('[AgentFactory] Creating ChatOpenAI client config', {
      provider: provider.label,
      baseURL: provider.baseURL,
      modelName: modelName,
      apiKey: maskedKey,
      apiKeyLength: apiKey ? apiKey.length : 0,
    });

    // Initializing dynamic ChatOpenAI class representing the base model
    return new ChatOpenAI({
      apiKey: apiKey,
      openAIApiKey: apiKey,
      modelName: modelName,
      streaming: true,
      configuration: {
        baseURL: provider.baseURL,
        apiKey: apiKey,
      },
    });
  }

  /**
   * Factory Method: Builds and returns the compiled DeepAgent graph instance.
   * Leverages LRU caching to avoid expensive recompilation for the same agent.
   */
  async buildAgent(agentId, userId, checkpointer) {
    if (!agentId) throw new Error('Agent ID is required to build an agent');

    const agentIdStr = agentId._id ? agentId._id.toString() : agentId.toString();

    // Cache key: For standard agents it is the agentId. For Architect, it is namespaced by userId
    // because the Architect's toolbox and provider are user-specific.
    const cacheKey =
      agentIdStr === ARCHITECT_AGENT_ID ? `${ARCHITECT_AGENT_ID}:${userId}` : agentIdStr;

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
    } else {
      // 1.5 Fetch Standard Configuration from DB
      agent = await agentRepository.findById(agentId);
      if (agent && typeof agent.populate === 'function') {
        await agent.populate(['skills', 'mcps', 'knowledgeBases']);
      }
      if (!agent) throw new Error('Agent deleted or unavailable');

      if (!agent.providerId) throw new Error('Agent has no valid provider configured.');
      provider = await providerRepository.findById(agent.providerId);
      if (!provider) throw new Error('Configured Provider not found or was deleted.');

      // Per-user MCP connectors mean different users see different tools for
      // the *same* agent, so the compiled-instance cache must be namespaced
      // by user too (same reasoning as the Architect cache key below).
      usesPerUserMcp = (agent.mcps || []).some((mcp) => mcp.authMode === 'user');
    }

    const effectiveCacheKey = `${cacheKey}:${userId}`;

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
    const { tools: dynamicTools, mcpAppMap } = await resolveAgentTools(agent, userId);

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
          namespace: userMemoryNamespace(userId),
        })
      ),
      '/memories/agent/': gracefulBackend(
        new StoreBackend({
          store: memoryFilesStore,
          namespace: agentMemoryNamespace(userId, agentIdStr),
        })
      ),
    };

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

    const backend = new CompositeBackend(new VersionedStateBackend(), backendRoutes);

    const agentInstance = await createDeepAgent({
      model: llm,
      systemPrompt: personalizedPrompt,
      checkpointer: safeCheckpointer,
      store: getGlobalStore(),
      tools: dynamicTools,
      interruptOn: interruptOnConfig,
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
      providerConfig: {
        id: provider._id?.toString?.() || provider._id,
        label: provider.label,
        apiKey: encryption.decrypt(provider.apiKeyEncrypted),
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
