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

/**
 * The Developer Platform Architect (blueprint Phase 11.5 follow-up) — a
 * third sentinel, reachable over `/api/v1/developer/architect/agui` via the
 * Developer Platform's machine-credential auth instead of Clerk. Shares
 * `projectBuilder.tools.js`'s toolbox with the Project Architect above (both
 * already dispatch generically on `context.principalType`), but is reached
 * by `ProjectMachineContext`/`ProjectRuntimeContext`, never
 * `ProjectAdminContext` — never the same sentinel as either agent above.
 */
export const DEVELOPER_ARCHITECT_AGENT_ID = '000000000000000000000002';
