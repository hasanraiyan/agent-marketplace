import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import developerAguiController from './developerAgui.controller.js';

/**
 * Developer AG-UI route (blueprint Phase 8, PR-23b) — a Project-
 * authenticated route sharing the exact same runtime layer
 * (runAgentAsAguiEvents / AgentFactory.buildAgent / AG-UI event
 * translation) the existing Persona-only /api/v1/agui route already uses,
 * per AD-07 §20 ("the route is new; the runtime is shared").
 *
 * Mounted before express.json() in index.js, same raw-body-before-json
 * reasoning as /api/v1/agui (readJsonBody parses the stream itself).
 * Authenticated by Project credential (developerMachineAuthMiddleware),
 * never Clerk — a structurally separate middleware chain, per AD-01 §13.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/agui:
 *   get:
 *     tags: [Developer]
 *     summary: Developer AG-UI protocol information
 *     security: [{ projectCredential: [] }]
 *     responses:
 *       200:
 *         description: Protocol information
 *   post:
 *     tags: [Developer]
 *     summary: Run an Agent as an external user, streaming AG-UI events (SSE)
 *     description: >
 *       Requires a ProjectRuntimeContext — the credential must be paired
 *       with the x-persona-external-user-id header asserting which of the
 *       Project's own external users is running the Agent. Reuses the
 *       exact same runtime as the Persona AG-UI route. Pass x-thread-id
 *       (a Thread id from POST /api/v1/developer/threads) to resume a
 *       named conversation — omit it to keep using the implicit,
 *       Domain-extended deterministic thread id (one conversation per
 *       Agent + external user). An unrecognized/foreign/wrong-agent
 *       x-thread-id is rejected with 404 rather than silently falling
 *       back to the deterministic id (same contract as the Persona AG-UI
 *       route).
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-agent-id
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *       - name: x-thread-id
 *         in: header
 *         required: false
 *         schema:
 *           type: string
 *         description: A Thread id from the Developer Thread CRUD API — resumes that conversation instead of the implicit deterministic one.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string, enum: [user, assistant] }
 *                     content: { type: string }
 *               resume:
 *                 type: object
 *                 description: >
 *                   Resume data for a Thread paused on an interrupt. Shape
 *                   depends on what the run is waiting on — a `hitl_request`
 *                   (a tool the Agent's `interruptOn` config requires
 *                   confirming) takes { decisions: [{ type: "approve" |
 *                   "reject", message? }] }; a `clarification_request` takes
 *                   { answers: [...], text? }; a `frontend_tool_request`
 *                   takes { toolResults: [{ toolCallId, result?, error? }] }
 *                   — one entry per call, `error` for a failure or the user
 *                   declining (a call left unanswered is reported to the
 *                   model as not completed). Send `tools` again on a
 *                   frontend-tool resume.
 *               tools:
 *                 type: array
 *                 maxItems: 20
 *                 description: >
 *                   Frontend tools — tools the client app runs itself (e.g.
 *                   in the end user's browser), in the AG-UI
 *                   `RunAgentInput.tools` shape. Ignored unless the Agent has
 *                   `frontendToolsEnabled`, and on voice/SMS/WhatsApp turns.
 *                   When the model calls one, the run pauses and streams a
 *                   `frontend_tool_request` CUSTOM event with
 *                   { calls: [{ toolCallId, name, args }] }; run the tools and
 *                   resume with `resume.toolResults`. Invalid entries (bad
 *                   name, schema over 8 KB, or a name clashing with one of
 *                   the Agent's own tools) are dropped, not rejected.
 *                 items:
 *                   type: object
 *                   required: [name]
 *                   properties:
 *                     name:
 *                       type: string
 *                       pattern: '^[a-zA-Z0-9_-]{1,64}$'
 *                     description:
 *                       type: string
 *                       maxLength: 1024
 *                       description: What the tool does and when to use it — the model reads this.
 *                     parameters:
 *                       type: object
 *                       description: JSON Schema (type "object") of the tool's arguments. Defaults to no arguments.
 *               contextOverride:
 *                 type: string
 *                 maxLength: 4000
 *                 description: >
 *                   Caller-supplied context (e.g. a live founder profile
 *                   snapshot) appended to this turn's system prompt only.
 *                   Never persisted to any memory file and never visible to
 *                   later turns.
 *               context:
 *                 type: object
 *                 additionalProperties:
 *                   type: [string, number, boolean]
 *                 description: >
 *                   Distinct from contextOverride above — never appended to
 *                   the prompt and never shown to the model in any form.
 *                   A flat object of string/number/boolean values only (no
 *                   nesting), capped at 2000 bytes serialized. Feeds only an
 *                   Agent's attached RCP Source's `paramContextMap`
 *                   resolvers: a param mapped there is always hidden from
 *                   the model, and its value is filled live from this
 *                   object's matching key on every turn it's sent. See the
 *                   RCP Sources guide for configuring the mapping.
 *     responses:
 *       200:
 *         description: >
 *           A `text/event-stream` SSE stream of AG-UI protocol events (the
 *           standard `@ag-ui/core` EventType values): RUN_STARTED once at
 *           the start of the run; TEXT_MESSAGE_CHUNK for streamed assistant
 *           text deltas; REASONING_MESSAGE_START/CONTENT/END for models
 *           that expose reasoning; TOOL_CALL_CHUNK/TOOL_CALL_RESULT for
 *           tool invocations and their results; STATE_SNAPSHOT for
 *           full-state updates; CUSTOM for Persona-specific side-channel
 *           events (e.g. subagent traces, MCP structured content, MCP App
 *           widgets); RUN_ERROR (native @ag-ui/core event, not CUSTOM) with
 *           `code`/`message`/`retryable`/`providerName` when the run fails
 *           genuinely rather than pausing on an interrupt — see
 *           GET /api/v1/developer/agui/schema for the CUSTOM event payload
 *           shapes and the RUN_ERROR `code` enum; and RUN_FINISHED once at
 *           the end. Each event is a JSON object sent as one `data: ` line
 *           per SSE convention.
 *         headers:
 *           X-AGUI-Schema-Version:
 *             description: The active custom-event schema version (see GET /api/v1/developer/agui/schema).
 *             schema:
 *               type: string
 *               example: "1.2.0"
 *       400:
 *         description: Missing x-agent-id, or credential has no asserted external user
 *       401:
 *         description: Missing or invalid Project credential
 *       403:
 *         description: Project is not currently ACTIVE
 *       404:
 *         description: >
 *           Agent not found (or not executable by this Domain/Subject), or
 *           x-thread-id was given but doesn't resolve to one of this
 *           Subject's own Threads for this Agent.
 */
/**
 * @openapi
 * /api/v1/developer/agui/schema:
 *   get:
 *     tags: [Developer]
 *     summary: Versioned schema for the custom AG-UI events this backend emits
 *     description: >
 *       Documents every non-base-protocol `CUSTOM` AG-UI event this backend
 *       streams (clarification_request, frontend_tool_request, hitl_request,
 *       mcp_app, subagent_activity, workflow_node_*) with a resolvable JSON
 *       Schema per payload. The
 *       base `@ag-ui/core` protocol version is fixed and unaffected by this
 *       document's own schemaVersion. Every POST /api/v1/developer/agui
 *       stream response also carries the active schemaVersion on the
 *       X-AGUI-Schema-Version response header.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: version
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *         description: Echoed back as-is; only "latest" (the current version) is served today.
 *     responses:
 *       200:
 *         description: The event schema document.
 */
router.get('/schema', developerAguiController.getSchema);
router.get('/', developerAguiController.getProtocolInfo);
router.post('/', rateLimiter('CHAT', RATE_LIMITS.CHAT), developerAguiController.runAgent);

export default router;
