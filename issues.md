# Tracked Issues & Technical Root Cause Analysis

This document tracks bugs identified, investigated, and resolved across the Persona agent runtime, voice gateway, tools execution engine, and SDKs for future reference.

---

## 1. RCP Sources Failing in Voice Sessions (`[RCP] discover: GET undefined`)

### Symptom
When interacting with an agent via normal text AG-UI chat, RCP (REST Connector Protocol) tools work as expected. However, when invoking the agent via Voice (`VoiceSession`), RCP discovery fails with:
```
[INFO] [RCP] discover: GET undefined
[WARN] [RcpSource] failed to load tools from "undefined": Failed to parse URL from undefined
[INFO] [Voice] tools resolved for session { agentId: '...', toolCount: 2, tools: [ { name: 'present_file' }, { name: 'search_web' } ] }
```
RCP tools are dropped from the session's available tool declarations.

### Root Cause
1. In `agent-backend/src/modules/voice/gateway/voiceGateway.js`, the WebSocket upgrade handler for `ProjectRuntime` retrieved the agent document via `agentRepository.findById(claims.agentId)` but did not invoke `.populate()` before passing the candidate to `buildVoiceLiveConfig(agent, claims.domain, context)`. As a result, `agent.rcpSources` remained an array of raw MongoDB `ObjectId`s instead of populated documents. When `resolveRcpSourceTools` iterated over `agent.rcpSources`, `source.url` was `undefined`.
2. In `agent-backend/src/modules/agents/agent.service.js`, `getDeveloperAgentById`, `getAgentById`, and `getAgentBySlug` populated `rcpSources` without projecting `authType` and `secretRef`, preventing authenticated RCP manifests from resolving.

### Fix
- Updated `voiceGateway.js` (`ProjectRuntime` and `ProjectAdmin` branches) to call `await candidate.populate(['skills', 'mcps', 'knowledgeBases', 'storeMounts', 'restApiTools', 'restApiToolSources', 'rcpSources'])`.
- Updated `agent.service.js` to populate `rcpSources` with `'name description url isEnabled paramContextMap authType secretRef'`.

---

## 2. Dynamic Tool `turnContext` Undefined in Voice Sessions

### Symptom
When an RCP tool configured with dynamic parameter resolvers (e.g., mapping `userId`, `patientId`, or caller metadata from session context) executed during a voice session, the parameters failed to resolve or resolved as empty.

### Root Cause
In `agent-backend/src/modules/rcpSources/rcpSource.tools.js`, `turnContext` was retrieved solely using LangGraph's AsyncLocalStorage helper:
```javascript
const turnContext = getConfig()?.configurable?.turnContext;
```
While this works inside LangGraph execution graphs (AG-UI text chat), `VoiceSession.js` executes tool calls directly via `tool.invoke(args, { configurable: { turnContext: this.turnContext } })` outside of LangGraph. In direct invocation mode, `getConfig()` returns `undefined`.

### Fix
Updated the DynamicStructuredTool execution function signature in `rcpSource.tools.js` to accept `(agentArgs, runManager, config)` and read `turnContext` with fallback:
```javascript
const turnContext =
  config?.configurable?.turnContext ?? getConfig()?.configurable?.turnContext;
```
Added unit test in `agent-backend/tests/rcpSource.tools.test.js`.

---

## 3. Developer Studio Voice Playground Missing Attached Resources

### Symptom
Testing agents in Developer Studio Voice mode (`ProjectAdmin` claims) failed to load custom tools (skills, MCPs, REST API tools, RCP tools, Knowledge Bases).

### Root Cause
In `agent-backend/src/modules/voice/gateway/voiceGateway.js` (`ProjectAdmin` ticket validation branch), `claims.agentId` was passed directly or without populating relations, causing `buildVoiceLiveConfig` to see unpopulated ObjectIds.

### Fix
- Looked up candidate agent via `agentRepository.findById(claims.agentId)`.
- Verified execution permissions with `agentService.canUserExecuteAgent(candidate, context)`.
- Populated all 7 attached tool collections before calling `buildVoiceLiveConfig`.

---

## 4. Unhandled Crash on Project Knowledge Bases (`Cannot read properties of null (reading 'toString')`)

### Symptom
Agents with attached Knowledge Bases owned by a `Project` (where `ownerType: 'Project'` and `ownerId: null`) crashed with:
```
TypeError: Cannot read properties of null (reading 'toString')
  at kb.ownerId.toString() in knowledge.tools.js
```
This crashed tool resolution across both Voice and AG-UI runtimes.

### Root Cause
In `agent-backend/src/modules/knowledge/knowledge.tools.js`, the authorization filter checked:
```javascript
kb.isPublic ||
(context && isResourceOwner(kb, context)) ||
(kb.ownerId && userId && kb.ownerId.toString() === userId.toString())
```
Without optional chaining or null guards on `kb.ownerId`, any project-owned KB (where `ownerId` is `null` and ownership is defined by `domain`) caused a null pointer dereference.

### Fix
- Updated `knowledge.tools.js` to accept `context` and use `isResourceOwner(kb, context)`.
- Added domain-level matching: `(kb.domain && context?.domain && kb.domain === context.domain)`.
- Guarded `kb.ownerId`: `(kb.ownerId && userId && kb.ownerId.toString() === userId.toString())`.
- Normalized IDs in `knowledge.repository.js#findKbsByIds` to handle both raw ObjectIds and populated objects.
- Added unit test in `agent-backend/tests/knowledgeTools.test.js`.

---

## 5. Knowledge Base Metadata Truncation in Agent Service

### Symptom
When agents were loaded via `agentService.getAgentById`, `getAgentBySlug`, or `getDeveloperAgentById`, Knowledge Base tools could not initiate vector search due to missing `collectionName`.

### Root Cause
The Mongoose `.populate('knowledgeBases', 'name description documentCount chunkCount')` projection omitted `collectionName`, `ownerType`, `ownerId`, `domain`, and `isPublic`.

### Fix
Updated `.populate('knowledgeBases', ...)` across `agent.service.js` to include:
`'name description documentCount chunkCount collectionName ownerType ownerId domain isPublic'`.

---

## 6. Twilio Voice Calls Missing Caller Context in VoiceSession

### Symptom
During incoming phone calls handled via Twilio Media Streams (`twilioGateway.js`), RCP tools and parameter resolvers could not access the caller's phone number or session identifiers.

### Root Cause
`twilioGateway.js` created `new VoiceSession({...})` without providing `initialContext`. Consequently, `VoiceSession` initialized `this.turnContext = undefined`.

### Fix
In `agent-backend/src/modules/twilio/twilioGateway.js`, populated `claims.context` with:
```javascript
context: {
  callerPhone,
  callSid,
  from: callerPhone,
  externalUserId: callerPhone,
}
```
and passed `initialContext: claims.context` to `VoiceSession`.

---

## 7. Mongoose `findOneAndUpdate` / `findOneAndReplace` `new` Deprecation

### Warning
```
(node:112) [MONGOOSE] Warning: mongoose: the `new` option for `findOneAndUpdate()` and `findOneAndReplace()` is deprecated. Use `returnDocument: 'after'` instead.
```

### Note
In Mongoose 9+, `{ returnDocument: 'after' }` replaces `{ new: true }`. Repository files (`thread.repository.js`, `externalUser.repository.js`) and corresponding unit tests that explicitly assert `{ new: true }` should be migrated in lockstep during planned database layer upgrades.
