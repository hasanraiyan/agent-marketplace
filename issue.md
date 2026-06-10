# Create/Builder Agent Flow Redesign Issue

## Summary

The create and builder experience currently mixes three different flows into one imported page:

- `/dashboard/agents/create` for creating a new agent
- `/dashboard/agents/builder` as a second create-like route
- `/dashboard/agents/:id/builder` and `/dashboard/agents/:id/edit` for editing an existing agent

This shared implementation creates confusing UX and at least two functional bugs: the architect tool result does not navigate after creating/updating because the frontend expects a top-level `agentId`, while the backend returns the agent under `data`; and the architect tools are configured for interrupt/resume, but the custom AG-UI chat UI does not expose an approval/resume control.

## Affected Routes

- `frontend/src/app/dashboard/agents/create/page.jsx`
- `frontend/src/app/dashboard/agents/builder/page.jsx`
- `frontend/src/app/dashboard/agents/[id]/builder/page.jsx`
- `frontend/src/app/dashboard/agents/[id]/edit/page.jsx`
- `frontend/src/components/agents/agent-form.jsx`
- `frontend/src/components/agents/agui-agent-chat.jsx`
- `frontend/src/lib/agui/use-agui-chat.js`
- `agent-backend/src/tools/builder.tools.js`
- `agent-backend/src/factories/agentFactory.js`
- `agent-backend/src/routes/agui.routes.js`

## Current Behavior

`/dashboard/agents/create` and `/dashboard/agents/:id/builder` both import and render `frontend/src/app/dashboard/agents/builder/page.jsx`. The page decides whether it is creating or editing by reading `useParams().id`.

The builder page renders two tabs:

- `Create`: an Agent Architect chat backed by the special architect agent id `000000000000000000000000`.
- `Configure`: a manual form that calls `createAgent` when no `agentId` exists and `updateAgent` when `agentId` exists.

The right-side Preview panel only works when an `agentId` already exists. On a fresh create route, preview stays in placeholder mode until the agent is created and the page navigates to `/dashboard/agents/:id/builder`.

The header action button says `Create` or `Update`, but it calls `handleManualSave(agent)`. On the fresh create route `agent` is `null`, so the button is disabled. On edit routes, this saves the last loaded `agent` object rather than the current form state.

## Confirmed Bugs

### 1. Architect create/update result contract mismatch

Frontend code in `frontend/src/app/dashboard/agents/builder/page.jsx` parses the `upsert_agent` result and checks:

```js
if (output?.status !== "success" || !output?.agentId) return;
```

Backend code in `agent-backend/src/tools/builder.tools.js` returns:

```js
{
  status: "success",
  message: "...",
  data: created
}
```

and the update path returns the same shape with `data: updated`.

There is no top-level `agentId`, so `handleArchitectCreated` and `handleArchitectUpdated` are never called. The user can see the tool finish, but the page will not route to the new builder URL or refresh edited data.

Required fix: standardize the tool result contract. Prefer returning:

```json
{
  "status": "success",
  "agentId": "...",
  "data": { "...": "..." }
}
```

and make the frontend accept both `output.agentId` and `output.data.id || output.data._id` for backward compatibility.

### 2. Architect tools require interrupt/resume, but custom AG-UI UI cannot approve

`agent-backend/src/factories/agentFactory.js` configures the architect with:

```js
interruptOn: {
  upsert_agent: true,
  manage_skill: true,
  delete_agent: true,
}
```

The AG-UI route stores interrupted threads and resumes when the next user message arrives, but `AguiAgentChat` does not show an approval card, approve/reject controls, or the pending action payload. This means the user has to infer from chat text what to reply, and create/update may feel stuck or broken.

Required fix: either remove interrupts for low-risk builder actions during the custom UI migration, or build a first-class approval UI for interrupted `upsert_agent`, `manage_skill`, and `delete_agent` calls.

### 3. Header save button is disconnected from form state

The dynamic header button calls:

```js
onClick={() => handleManualSave(agent)}
```

On create, `agent` is `null`; on edit, `agent` is stale server data, not current form edits. The real editable state lives inside `AgentForm`.

Required fix: remove this header save button or lift form state up into `BuilderPage` so the header action submits the actual form values. The simpler and safer fix is to keep save inside the form and make the header action route/navigation only.

### 4. Create route has no usable preview state

The preview panel only renders chat when `agentId && authToken && previewThreadId`. For a new agent, no `agentId` exists yet, so the right panel is always placeholder content.

Required fix: choose a target product behavior:

- Create-first flow: hide preview until the architect/form creates the agent.
- Draft-first flow: create a draft record immediately and use `/dashboard/agents/:id/builder` from the start.

The draft-first flow is better for a builder UI because preview, autosave, and tool updates all have one canonical `agentId`.

### 5. Duplicate route aliases create mental and technical debt

`/dashboard/agents/create` and `/dashboard/agents/builder` currently represent nearly the same no-id mode. `/dashboard/agents/:id/edit` also imports the builder page.

Required fix: define canonical routes:

- `/dashboard/agents/create`: start a new draft or show the new-agent wizard.
- `/dashboard/agents/:id/builder`: edit, chat with architect, configure, and preview.
- `/dashboard/agents/:id/run`: end-user run/chat surface.

Then redirect `/dashboard/agents/builder` and `/dashboard/agents/:id/edit` to the canonical route or remove links to them.

## Form Problems

### Provider/model state is fragile

`AgentForm` loads providers and defaults to the default provider. When the provider changes, the current `modelName` is not reset. A stale model from the previous provider can be submitted against a different provider.

Required fix:

- When `providerId` changes, clear `modelName`.
- After models load, select the provider default model if available.
- Disable save while providers or models are loading.
- Show an inline no-provider state with a link to provider settings.

### Errors are too generic

`handleManualSave` catches all failures and only shows `Save failed`. Backend validation has useful messages such as `System prompt must be at least 10 characters` and `Provider ID is required`, but the UI drops them.

Required fix: surface `err.response?.data?.message`, field errors where available, and architect tool errors inside the chat/tool trace.

### Initial data reset only works one way

`AgentForm` only calls `setForm(...)` when `initialData` is truthy. If this component is reused from edit to create, or an agent load fails and `initialData` becomes null, stale form values can remain.

Required fix: make form initialization explicit by mode. Reset to default empty values when creating, and hydrate from `initialData` when editing.

### Encoding and icon issues

The category icons and tag remove button show mojibake text such as `ðŸš€`, `ðŸ’»`, and `Ã—`.

Required fix: replace these strings with lucide icons or valid ASCII-safe labels. Use lucide icons for category cards and the save icon instead of inline SVG/manual encoded text.

### `hideHeader` prop is dead

`AgentForm` accepts `hideHeader`, but the component does not render any conditional header based on it.

Required fix: remove the prop or implement the hidden header behavior.

## AG-UI Chat/Builder Problems

### New chat clears local UI but does not create a new backend thread

`AguiAgentChat` calls `chat.clear()` on the new chat button. That clears client state but keeps the same `threadId`, so server-side checkpointer state and interrupted-thread state can remain attached.

Required fix: accept an `onNewChat` callback from `BuilderPage` and create a fresh thread for architect and preview chats. The button should clear local state only after the new thread is created.

### Tool result handling is too narrow

The builder listens only for `upsert_agent` results. Architect may also call `get_agent` after upsert as instructed by `ARCHITECT_SKILL`, but the UI does not use that verified payload to refresh state.

Required fix: handle successful `upsert_agent` and `get_agent` results. Refresh the agent from the API after a successful update, and route after successful creation.

### Tool traces hide actionable error states

`ToolTrace` can show raw JSON only when expanded. Failed tool calls should be immediately visible as errors, especially `Invalid providerId`, missing provider, or validation failures.

Required fix: parse tool JSON results and show `status: error` as a red inline tool card with the message.

## Recommended Target UX

Use one canonical builder shell.

For `/dashboard/agents/create`:

1. Load provider/model readiness first.
2. If no provider exists, show a focused empty state with a settings link.
3. Start with the Architect chat as the primary surface.
4. When the architect has enough information, call `upsert_agent`.
5. On success, create the agent, return `agentId`, and navigate to `/dashboard/agents/:id/builder`.

For `/dashboard/agents/:id/builder`:

1. Load agent details.
2. Show a three-zone workspace: Architect chat, Configure form, Preview.
3. Keep form and architect changes in sync by refreshing the agent after successful tools or manual saves.
4. New chat creates a fresh thread instead of only clearing local state.
5. Preview always uses the current agent id and can be reset independently.

## Required Frontend Changes

- Split the shared page into an explicit `AgentBuilderPage` component that receives `mode` and optional `agentId`.
- Make route pages thin wrappers:
  - `/create` passes `mode="create"`.
  - `/:id/builder` passes `mode="edit"` and `agentId`.
- Redirect or remove `/dashboard/agents/builder` and `/:id/edit`.
- Remove the stale header save button or wire it to lifted form state.
- Add provider/model empty, loading, and error states.
- Reset `modelName` when `providerId` changes.
- Show backend validation messages in toasts and inline form errors.
- Fix mojibake category icons and remove button text.
- Implement AG-UI new-chat thread creation.
- Add visible tool error rendering.
- Handle `output.agentId`, `output.data.id`, and `output.data._id` in architect tool results.

## Required Backend Changes

- Add top-level `agentId` to `upsert_agent` success responses for both create and update.
- Consider returning a normalized agent object with both `id` and `_id`.
- Decide whether architect `interruptOn` stays enabled.
- If interrupts stay enabled, define a structured interrupt payload that the AG-UI client can render as approve/reject controls.
- Ensure AG-UI resume responses are documented and tested.
- Add tests for `upsert_agent` result shape and architect create flow.

## Acceptance Criteria

- `/dashboard/agents/create` can create a new agent through the architect chat and automatically navigates to `/dashboard/agents/:id/builder`.
- `/dashboard/agents/create` can create a new agent through the form and navigates to `/dashboard/agents/:id/builder`.
- `/dashboard/agents/:id/builder` loads the selected agent, updates it through the architect chat, and refreshes the visible form/header data.
- `/dashboard/agents/:id/builder` updates the agent through the form and keeps preview usable.
- The preview panel has a clear create-mode state and a working edit-mode chat.
- The new chat button creates a fresh backend thread.
- No provider configured produces a clear UI state instead of a failed architect run.
- Provider/model changes cannot submit stale or invalid model values.
- Tool failures are visible without expanding raw JSON.
- The console has no maximum update depth errors on create, builder, or run routes.
- Browser QA covers desktop and mobile widths for create and edit builder routes.

## Verification Plan

- Run targeted lint for the frontend files touched by this flow.
- Run backend tests for builder tools and AG-UI translation.
- Manually verify:
  - `/dashboard/agents/create`
  - `/dashboard/agents/:id/builder`
  - `/dashboard/agents/:id/run`
- In browser QA, check:
  - page identity
  - nonblank render
  - no framework overlay
  - console errors/warnings
  - create through architect
  - create through form
  - update through architect
  - update through form
  - new-chat thread reset
  - preview reset

## Notes

The in-app browser runtime was not available during this analysis, so this issue is based on static code inspection. Rendered QA should be run before closing the implementation work.
