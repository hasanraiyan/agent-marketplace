import { Modality } from '@google/genai';
import providerRepository from '../providers/provider.repository.js';
import encryption from '../../utils/encryption.js';
import { loggerService } from '../../utils/index.js';
import { resolveAgentTools } from '../tools/index.js';
import { sanitizeToolsForGemini } from '../agents/sanitizeToolsForGemini.js';
import {
  DEFAULT_VOICE_MODEL,
  DEFAULT_VOICE_NAME,
  VOICE_MODE_PREAMBLE,
  CONTEXT_WINDOW_TRIGGER_TOKENS,
  CONTEXT_WINDOW_SLIDING_TARGET_TOKENS,
  EXCLUDED_VOICE_TOOL_NAMES,
  END_CALL_TOOL_DECLARATION,
} from './voice.constants.js';

const logger = loggerService.getLogger();

/**
 * Resolves which Gemini Provider a voice session for this Agent should use,
 * following voice-agent-plan.md §8's precedence: the Agent's own
 * `providerId` if it happens to be a Gemini provider, else the Domain's
 * default Gemini provider, else a named error rather than a silent
 * platform-wide-key fallback (that would bill the platform for a
 * developer's traffic — the same invariant `_buildLLM` already protects
 * for the text runtime).
 *
 * @param {*} agent - populated Agent document (agentService.getDeveloperAgentById)
 * @param {string} domain - Project id (ProjectAdminContext.domain)
 * @returns {Promise<{id: string, label: string, apiKey: string}>}
 */
export async function resolveVoiceProvider(agent, domain) {
  let provider = null;

  if (agent.providerId) {
    const own = await providerRepository.findById(agent.providerId);
    if (own && own.type === 'gemini') {
      provider = own;
    }
  }

  if (!provider) {
    const domainProviders = await providerRepository.findByDomain(domain);
    const geminiProviders = domainProviders.filter((p) => p.type === 'gemini');
    provider = geminiProviders.find((p) => p.isDefault) || geminiProviders[0] || null;
  }

  if (!provider) {
    const err = new Error(
      'This Project has no Gemini provider configured. Add one under Providers before starting a voice session.'
    );
    err.code = 'VOICE_PROVIDER_REQUIRED';
    err.statusCode = 422;
    throw err;
  }

  if (!provider.apiKeyEncrypted) {
    const err = new Error(`Gemini provider "${provider.label}" is missing an API key.`);
    err.code = 'VOICE_PROVIDER_REQUIRED';
    err.statusCode = 422;
    throw err;
  }

  let apiKey;
  try {
    apiKey = encryption.decrypt(provider.apiKeyEncrypted);
  } catch (err) {
    logger.error('[Voice] provider key decryption failed', {
      providerId: String(provider._id),
      err: err?.message,
    });
    const wrapped = new Error(
      `Stored API key for provider "${provider.label}" cannot be decrypted. Re-enter it in Settings.`
    );
    wrapped.code = 'VOICE_PROVIDER_REQUIRED';
    wrapped.statusCode = 422;
    throw wrapped;
  }

  return { id: String(provider._id), label: provider.label, apiKey };
}

/**
 * Refuses to build a voice session for an Agent that has any guarded tool
 * enabled (`interruptOn`) — there is no spoken confirmation flow yet
 * (voice-agent-plan.md §9), so silently executing a guarded tool without
 * the approval the Agent's own config demands would be worse than
 * refusing outright. Mirrors agent.factory.js's own Map-vs-plain-object
 * normalization for `interruptOn`.
 *
 * @param {*} agent
 * @throws {Error & {code: 'VOICE_INTERRUPT_ON_UNSUPPORTED', statusCode: 422}}
 */
export function assertNoGuardedTools(agent) {
  const interruptOnConfig =
    agent.interruptOn instanceof Map
      ? Object.fromEntries(agent.interruptOn)
      : agent.interruptOn || {};

  const hasGuardedTool = Object.values(interruptOnConfig).some(Boolean);
  if (hasGuardedTool) {
    const err = new Error(
      'This Agent has one or more guarded tools (interruptOn) enabled. Voice sessions have no spoken confirmation flow yet, so they are unsupported for this Agent until interruptOn is cleared.'
    );
    err.code = 'VOICE_INTERRUPT_ON_UNSUPPORTED';
    err.statusCode = 422;
    throw err;
  }
}

/**
 * Resolves this Agent's tools through the SAME `resolveAgentTools` path the
 * text runtime uses (voice-agent-plan.md §9) — MCP (per-user OAuth),
 * knowledge base search, and REST API tools all work identically. Excludes
 * `ask_clarification` (EXCLUDED_VOICE_TOOL_NAMES) since it depends on
 * LangGraph's `interrupt()`, which nothing here provides. There is no
 * `task` (subagent) tool to exclude — `resolveAgentTools` never returns
 * one; `createDeepAgent`'s `subagents` config is what adds it for the text
 * runtime, and voice never calls `createDeepAgent` at all.
 *
 * Declares from a SANITIZED copy (sanitizeToolsForGemini — same schema
 * fix-up the text runtime already needs for Gemini) but executes the
 * ORIGINAL tool, so voice never depends on the sanitizer's `.func` rebuild
 * (voice-agent-plan.md §9's refinement over the text path).
 *
 * @param {*} agent
 * @param {string} domain - Project id, passed as `userId` to match the
 *   existing ProjectAdmin-context precedent (projectAgentTest.controller.js)
 * @param {*} context - ProjectAdminContext (ProjectMachineContext /
 *   ProjectRuntimeContext once the Phase 2 machine route lands)
 * @returns {Promise<{functionDeclarations: Array, toolsByName: Map<string, *>}>}
 */
export async function resolveVoiceTools(agent, domain, context) {
  const { tools } = await resolveAgentTools(agent, domain, context);
  const executable = tools.filter((tool) => !EXCLUDED_VOICE_TOOL_NAMES.includes(tool.name));

  const sanitized = sanitizeToolsForGemini(executable);
  const functionDeclarations = sanitized.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.schema,
  }));

  const toolsByName = new Map(executable.map((tool) => [tool.name, tool]));

  return { functionDeclarations, toolsByName };
}

/**
 * Phase 1 has no `Agent.voice` subdocument yet (that's voice-agent-plan.md
 * §8/Phase 6) — so this builds the smallest correct Live config beyond
 * that: the Agent's own systemPrompt, voice-mode preamble, curated
 * defaults for model/voice, AUDIO-only response modality, both
 * transcription configs (mandatory — native-audio models emit no text at
 * all otherwise), session resumption, context-window compression, and
 * (per the tool-bridging pulled forward into this build) this Agent's own
 * tools as Gemini function declarations.
 *
 * @param {*} agent - populated Agent document
 * @param {string} domain
 * @param {*} context
 * @returns {Promise<{model: string, voiceName: string, liveConfig: object, toolsByName: Map<string, *>}>}
 */
export async function buildVoiceLiveConfig(agent, domain, context) {
  assertNoGuardedTools(agent);

  const model = DEFAULT_VOICE_MODEL;
  const voiceName = DEFAULT_VOICE_NAME;
  const systemInstruction = `${VOICE_MODE_PREAMBLE}\n\n${agent.systemPrompt || ''}`.trim();

  const { functionDeclarations, toolsByName } = await resolveVoiceTools(agent, domain, context);
  // end_call is always present, regardless of the Agent's own configured
  // tools — every voice call needs a way to hang up. It's handled specially
  // in VoiceSession (never routed through `toolsByName`), so it's appended
  // here rather than inside resolveVoiceTools, which only resolves the
  // Agent's real, executable tools.
  const allDeclarations = [...functionDeclarations, END_CALL_TOOL_DECLARATION];

  const liveConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction,
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName } },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    sessionResumption: {},
    contextWindowCompression: {
      triggerTokens: CONTEXT_WINDOW_TRIGGER_TOKENS,
      slidingWindow: { targetTokens: CONTEXT_WINDOW_SLIDING_TARGET_TOKENS },
    },
    tools: [{ functionDeclarations: allDeclarations }],
  };

  return { model, voiceName, liveConfig, toolsByName };
}

export default { resolveVoiceProvider, assertNoGuardedTools, resolveVoiceTools, buildVoiceLiveConfig };
