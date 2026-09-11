import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import agentService from '../agents/agent.service.js';
import agentRepository from '../agents/agent.repository.js';
import skillService from '../skills/skill.service.js';
import providerRepository from '../providers/provider.repository.js';

/**
 * ARCHITECT TOOLBOX:
 * A specialized set of tools that allow an LLM to build and manage agents and skills.
 */

/**
 * list_my_providers - Allows the architect to see what engines are available.
 * STRICTLY STRIPS API KEYS.
 */
export const listProvidersTool = (userId) =>
  new DynamicStructuredTool({
    name: 'list_my_providers',
    description:
      'Lists all LLM providers (base URLs, default models) configured by the user. Use this to help the user choose a model for their agent. Sensitive keys are NOT included.',
    schema: z.object({}),
    func: async () => {
      try {
        const providers = await providerRepository.findByUser(userId);
        return JSON.stringify({
          status: 'success',
          data: providers.map((p) => ({
            id: p._id,
            label: p.label,
            baseURL: p.baseURL,
            defaultModel: p.defaultModel,
          })),
        });
      } catch (err) {
        return JSON.stringify({
          status: 'error',
          message: err.message,
        });
      }
    },
  });

/**
 * Normalizes an agent document for tool output so clients can rely on both
 * `id` and `_id` being present regardless of Mongoose serialization.
 */
const normalizeAgentPayload = (agent) => {
  if (!agent) return agent;
  const plain = typeof agent.toObject === 'function' ? agent.toObject() : { ...agent };
  const id = plain._id ?? plain.id;
  if (id != null) {
    plain.id = id.toString();
    plain._id = id.toString();
  }
  return plain;
};

/**
 * upsert_agent - Full control over the target agent's configuration.
 */
export const upsertAgentTool = (userId) =>
  new DynamicStructuredTool({
    name: 'upsert_agent',
    description:
      'Creates or updates an agent configuration. Handles basic info, instructions, and runtime settings.',
    schema: z.object({
      agentId: z
        .string()
        .optional()
        .describe('ID of the agent to update. Leave empty to create a new one.'),
      name: z.string().optional().describe('Name of the agent'),
      description: z.string().optional().describe('Brief summary of what the agent does'),
      systemPrompt: z
        .string()
        .optional()
        .describe('The primary instructions defining the agent behavior'),
      providerId: z.string().optional().describe('ID of the LLM provider to use'),
      modelName: z.string().optional().describe('Specific model (e.g., gpt-4o)'),
      webSearchEnabled: z.boolean().optional().describe('Toggle for web search capability'),
      avatar: z.string().optional().describe('URL to the agent avatar image'),
      tags: z.array(z.string()).optional().describe('Tags for categorization and search'),
      category: z
        .enum(['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'])
        .optional(),
      visibility: z.enum(['private', 'unlisted', 'public']).optional(),
      tagline: z.string().max(150).optional().describe("One-line positioning in the buyer's words, under 100 chars"),
      bio: z.string().max(1000).optional().describe('Short third-person bio shown on the profile'),
      category: z.enum(['productivity', 'coding', 'creative', 'research', 'roleplay', 'other']).optional(),
      skills: z.array(z.string()).optional().describe('Array of Skill IDs to link to this agent (replaces the list; include existing ids to keep them)'),
    }),
    func: async (input) => {
      try {
        // Clean up empty strings for optional fields
        const sanitized = { ...input };
        if (sanitized.description === '') delete sanitized.description;
        if (sanitized.avatar === '') delete sanitized.avatar;
        if (sanitized.modelName === '') delete sanitized.modelName;

        // Verify provider ownership if providerId is changed
        if (sanitized.providerId) {
          const provider = await providerRepository.findById(sanitized.providerId);
          if (!provider || provider.ownerId.toString() !== userId.toString()) {
            return JSON.stringify({
              status: 'error',
              message: 'Invalid providerId or unauthorized.',
            });
          }
        }

        if (sanitized.agentId) {
          const updated = await agentService.updateAgent(sanitized.agentId, userId, {
            ...sanitized,
          });
          const data = normalizeAgentPayload(updated);
          return JSON.stringify({
            status: 'success',
            message: `Successfully updated agent: ${updated.name}`,
            agentId: data.id,
            data,
          });
        } else {
          if (!sanitized.name || !sanitized.systemPrompt || !sanitized.providerId) {
            return JSON.stringify({
              status: 'error',
              message: 'Name, systemPrompt, and providerId are required to create a new agent.',
            });
          }
          const created = await agentService.createAgent(userId, { ...sanitized });
          const data = normalizeAgentPayload(created);
          return JSON.stringify({
            status: 'success',
            message: `Successfully created new agent: ${created.name}`,
            agentId: data.id,
            data,
          });
        }
      } catch (err) {
        return JSON.stringify({
          status: 'error',
          message: `Error managing agent: ${err.message}`,
        });
      }
    },
  });

/**
 * manage_skill - skill lifecycle operations (list / delete / visibility).
 *
 * Skill CONTENT is authored via the /skill-library/ filesystem route
 * (write_file/edit_file on SKILL.md and supporting files), not this tool.
 */
export const manageSkillTool = (userId) =>
  new DynamicStructuredTool({
    name: 'manage_skill',
    description:
      "Skill lifecycle: publish one (sets title, hook, category, visibility and attaches it to the persona), delete one, or toggle visibility. To CREATE or EDIT skill content, write files under /skill-library/<skill-name>/ instead. To LIST skills use list_my_skills.",
    schema: z.object({
      action: z.enum(['list', 'delete', 'set_visibility', 'publish']),
      skillId: z
        .string()
        .optional()
        .describe('ID of the skill (required for delete/set_visibility)'),
      isPublic: z
        .boolean()
        .optional()
        .describe('Marketplace visibility (required for set_visibility)'),
      title: z.string().max(120).optional().describe('publish: display title, e.g. "Coach a PM career transition"'),
      hook: z.string().max(200).optional().describe("publish: one line in the client's words — what this lets the persona do for them"),
      category: z.enum(['entrepreneurship', 'health-fitness', 'mind-behavior', 'technology', 'life-relationships', 'careers', 'other']).optional(),
      tags: z.array(z.string().max(40)).max(12).optional(),
      visibility: z.enum(['public', 'unlisted', 'private']).optional().describe('publish: defaults to public'),
    }),
    func: async (input) => {
      try {
        switch (input.action) {
          case 'list': {
            const skills = await skillService.getMySkills(userId);
            return JSON.stringify({
              status: 'success',
              data: skills.map((s) => ({
                id: s._id,
                name: s.name,
                description: s.description,
                isPublic: s.isPublic,
                fileCount: (s.files?.length || 0) + 1,
              })),
            });
          }
          case 'delete': {
            if (!input.skillId) {
              return JSON.stringify({
                status: 'error',
                message: 'skillId is required for delete.',
              });
            }
            await skillService.deleteSkill(input.skillId, userId);
            return JSON.stringify({
              status: 'success',
              message: 'Skill deleted permanently.',
            });
          }
          case 'publish': {
            if (!input.skillId) {
              return JSON.stringify({ status: 'error', message: 'skillId is required for publish.' });
            }
            const patch = { visibility: input.visibility || 'public' };
            if (input.title) patch.title = input.title;
            if (input.hook) patch.hook = input.hook;
            if (input.category) patch.category = input.category;
            if (input.tags) patch.tags = input.tags;
            const published = await skillService.updateSkill(input.skillId, userId, patch);
            return JSON.stringify({
              status: 'success',
              message: `Skill "${published.title || published.name}" is now ${published.visibility} and attached to the persona.`,
              data: { id: published._id, name: published.name, title: published.title, hook: published.hook, category: published.category, visibility: published.visibility },
            });
          }
          case 'set_visibility': {
            if (!input.skillId || typeof input.isPublic !== 'boolean') {
              return JSON.stringify({
                status: 'error',
                message: 'skillId and isPublic are required for set_visibility.',
              });
            }
            const updatedSkill = await skillService.updateSkill(input.skillId, userId, {
              isPublic: input.isPublic,
            });
            return JSON.stringify({
              status: 'success',
              message: `Skill is now ${updatedSkill.isPublic ? 'public' : 'private'}.`,
              data: {
                id: updatedSkill._id,
                name: updatedSkill.name,
                isPublic: updatedSkill.isPublic,
              },
            });
          }
          default:
            return JSON.stringify({ status: 'error', message: 'Invalid action.' });
        }
      } catch (err) {
        return JSON.stringify({
          status: 'error',
          message: `Error managing skill: ${err.message}`,
        });
      }
    },
  });

/**
 * get_agent - Fetch a single agent by ID.
 */
export const getAgentTool = (userId) =>
  new DynamicStructuredTool({
    name: 'get_agent',
    description: 'Retrieves the full configuration of a specific agent by its ID.',
    schema: z.object({
      agentId: z.string().describe('The ID of the agent to fetch'),
    }),
    func: async ({ agentId }) => {
      try {
        const agent = await agentService.getAgentById(agentId, userId);
        return JSON.stringify({
          status: 'success',
          data: agent,
        });
      } catch (err) {
        return JSON.stringify({
          status: 'error',
          message: err.message,
        });
      }
    },
  });

/**
 * list_my_agents - List all agents owned by the user.
 */
export const listMyAgentsTool = (userId) =>
  new DynamicStructuredTool({
    name: 'list_my_agents',
    description: 'Lists all agents owned by the current user.',
    schema: z.object({}),
    func: async () => {
      try {
        const agents = await agentService.searchAgents({ ownerId: userId }, {}, userId);
        return JSON.stringify({
          status: 'success',
          data: agents.map((a) => ({
            id: a._id,
            name: a.name,
            description: a.description,
            visibility: a.visibility,
          })),
        });
      } catch (err) {
        return JSON.stringify({
          status: 'error',
          message: err.message,
        });
      }
    },
  });

/**
 * delete_agent - Deletes an agent.
 */
export const deleteAgentTool = (userId) =>
  new DynamicStructuredTool({
    name: 'delete_agent',
    description: 'Permanently deletes an agent owned by the user.',
    schema: z.object({
      agentId: z.string().describe('The ID of the agent to delete'),
    }),
    func: async ({ agentId }) => {
      try {
        await agentService.deleteAgent(agentId, userId);
        return JSON.stringify({
          status: 'success',
          message: 'Agent deleted successfully.',
        });
      } catch (err) {
        return JSON.stringify({
          status: 'error',
          message: err.message,
        });
      }
    },
  });

/**
 * get_builder_toolbox - Factory for all architect tools injected with contextual userId
 */
/**
 * list_my_skills - read-only listing (no approval needed). Use before creating a skill.
 */
export const listMySkillsTool = (userId) =>
  new DynamicStructuredTool({
    name: 'list_my_skills',
    description:
      "Lists the user's existing skills with ids, names, titles, visibility, and whether each is attached to the persona. ALWAYS call this before creating a skill so you edit an existing one instead of duplicating it.",
    schema: z.object({}),
    func: async () => {
      try {
        const [skills, persona] = await Promise.all([
          skillService.getMySkills(userId),
          agentRepository.findOne({ ownerId: userId, isMainAgent: true, isActive: true }),
        ]);
        const attached = new Set((persona?.skills || []).map((id) => String(id)));
        return JSON.stringify({
          status: 'success',
          persona: persona ? { id: persona._id, name: persona.name, visibility: persona.visibility } : null,
          data: skills.map((s) => ({
            id: s._id,
            name: s.name,
            title: s.title || '',
            description: s.description,
            visibility: s.visibility || (s.isPublic ? 'public' : 'private'),
            attachedToPersona: attached.has(String(s._id)),
            files: (s.files || []).map((f) => f.path),
          })),
        });
      } catch (err) {
        return JSON.stringify({ status: 'error', message: err.message });
      }
    },
  });

/**
 * test_persona - run ONE real turn of the creator's persona on a scratch thread
 * and return what it says. This is the voice test; never fake it.
 */
const TEST_PERSONA_MAX_PER_WINDOW = 5;
const TEST_PERSONA_WINDOW_MS = 10 * 60 * 1000;
const testPersonaCalls = new Map(); // userId -> [timestamps]
const testPersonaCache = new Map(); // userId -> [{ message, skillName, reply }] (last 5)

export const testPersonaTool = (userId) =>
  new DynamicStructuredTool({
    name: 'test_persona',
    description:
      "Runs the creator's persona (their main agent) for one turn on a throwaway thread with the given client message and returns the persona's actual reply. Use for the voice test, intake test, and boundary test before finishing. Optionally pin a skill by name.",
    schema: z.object({
      message: z.string().min(1).max(4000).describe('What a client would say'),
      skillName: z.string().optional().describe('Skill folder name to pin for this test'),
    }),
    func: async ({ message, skillName }) => {
      try {
        // Each test runs the persona for real (30–90s). Cap it so the creator
        // is shown results and asked, instead of waiting through a dozen runs.
        const now = Date.now();
        const recent = (testPersonaCalls.get(String(userId)) || []).filter((t) => now - t < TEST_PERSONA_WINDOW_MS);
        if (recent.length >= TEST_PERSONA_MAX_PER_WINDOW) {
          const cached = testPersonaCache.get(String(userId)) || [];
          return JSON.stringify({
            status: 'limited',
            message: `You have used ${TEST_PERSONA_MAX_PER_WINDOW} tests in the last 10 minutes. Do NOT call test_persona again this turn and do not tell the creator to wait. Paste the replies below verbatim, tell the creator which is which, and ask for their read.`,
            recentTests: cached,
          });
        }
        recent.push(now);
        testPersonaCalls.set(String(userId), recent);
        const persona = await agentRepository.findOne({ ownerId: userId, isMainAgent: true, isActive: true });
        if (!persona) return JSON.stringify({ status: 'error', message: 'No persona yet. Create it with upsert_agent first.' });
        const { runAgentAsAguiEvents } = await import('../agui/agui.service.js');
        const { AsyncLocalStorageProviderSingleton } = await import('@langchain/core/singletons');
        let contextOverride;
        if (skillName) {
          const skills = await skillService.getMySkills(userId);
          const sk = skills.find((x) => x.name === skillName);
          if (sk) contextOverride = `### PINNED SKILL: ${sk.title || sk.name}\nThe visitor came here to use this specific skill of yours. Apply it deliberately.\n\n${sk.instructions}`;
        }
        // This tool runs INSIDE the Architect's own graph run. Without
        // isolation the nested persona run inherits the outer callbacks, and
        // the AG-UI scope tracker files all its text as a sub-run and drops it.
        const run = await AsyncLocalStorageProviderSingleton.runWithConfig(
          { callbacks: [], tags: [], metadata: {} },
          async () => {
            let text = '';
            const toolsUsed = [];
            let runError = null;
            for await (const ev of runAgentAsAguiEvents({
              agentId: String(persona._id),
              userId,
              langGraphThreadId: `test-${persona._id}-${Date.now()}`,
              messages: [{ id: `t-${Date.now()}`, role: 'user', content: message }],
              contextOverride,
            })) {
              if (ev.type === 'TEXT_MESSAGE_CHUNK' && ev.role !== 'reasoning') text += ev.delta ?? '';
              else if (ev.type === 'TOOL_CALL_CHUNK' && ev.toolCallName) toolsUsed.push(ev.toolCallName);
              else if (ev.type === 'CUSTOM' && ev.name === 'clarification_request') {
                const qs = (ev.value?.questions || []).map((q) => q.question || q.text || '').filter(Boolean);
                text += `\n[asked: ${qs.join(' | ')}]`;
              } else if (ev.type === 'RUN_ERROR') runError = ev.message;
            }
            return { text, toolsUsed, runError };
          },
          true
        );
        if (run.runError) return JSON.stringify({ status: 'error', message: run.runError });
        const { text, toolsUsed } = run;
        const reply = text.trim().slice(0, 3500);
        const cache = testPersonaCache.get(String(userId)) || [];
        cache.push({ message: message.slice(0, 300), skillName: skillName || null, reply });
        testPersonaCache.set(String(userId), cache.slice(-5));
        return JSON.stringify({ status: 'success', reply, toolsUsed: [...new Set(toolsUsed)] });
      } catch (err) {
        return JSON.stringify({ status: 'error', message: `test_persona failed: ${err.message}` });
      }
    },
  });

export const getBuilderToolbox = (userId) => [
  listMySkillsTool(userId),
  testPersonaTool(userId),
  listProvidersTool(userId),
  upsertAgentTool(userId),
  manageSkillTool(userId),
  getAgentTool(userId),
  listMyAgentsTool(userId),
  deleteAgentTool(userId),
];
