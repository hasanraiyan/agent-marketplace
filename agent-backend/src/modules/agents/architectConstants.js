/**
 * Leaf module (no imports) so the Architect's pseudo agent id can be shared
 * across modules that participate in import cycles (tools ↔ factories).
 */
export const ARCHITECT_AGENT_ID = '000000000000000000000000';

/**
 * The Project Agent Architect (blueprint Phase 11.5, PR-62) — a dedicated,
 * Domain-aware sibling of the Persona-only Architect above, never the same
 * sentinel. Lets a Project Admin build/edit their Project's own Agents via
 * the same conversational-tool-calling pattern, without threading a
 * `ProjectAdminContext` through the live Persona Architect's factory branch
 * or `builder.tools.js`.
 */
export const PROJECT_ARCHITECT_AGENT_ID = '000000000000000000000001';
