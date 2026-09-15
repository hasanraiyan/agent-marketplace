#!/usr/bin/env node
/**
 * typedoc-resources.mjs — Generate per-resource field-table MDX from TypeDoc JSON
 * for platform/content/docs/sdk/v{version}/resources/*.mdx
 *
 * Input:  sdk/typescript/dist/typedoc.json
 * Output: platform/content/docs/sdk/v{version}/resources/{agents,skills,...}.mdx
 *
 * Each file contains one section per related interface with a field table
 * (| Field | Type | Description |) extracted from TypeDoc's comment/type.
 * Generated files carry "Generated from ..." header and are not to be hand-edited.
 *
 * JS-only, SDK-focused for greenfield. Runtime/adapters/react have simpler type
 * indexes (types.mdx) — per-resource tables deferred unless needed.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const SDK = {
  id: 'sdk',
  typedocJson: 'sdk/typescript/dist/typedoc.json',
  outBase: 'platform/content/docs/sdk',
  version: JSON.parse(readFileSync(join(repoRoot, 'sdk/typescript/package.json'), 'utf8')).version,
};

const OTHER_SDKS = [
  {
    id: 'runtime',
    typedocJson: 'sdk/runtime/dist/typedoc.json',
    outBase: 'platform/content/docs/runtime',
    version: JSON.parse(readFileSync(join(repoRoot, 'sdk/runtime/package.json'), 'utf8')).version,
  },
  {
    id: 'adapters',
    typedocJson: 'sdk/adapters/dist/typedoc.json',
    outBase: 'platform/content/docs/adapters',
    version: JSON.parse(readFileSync(join(repoRoot, 'sdk/adapters/package.json'), 'utf8')).version,
  },
  {
    id: 'react',
    typedocJson: 'sdk/react/dist/typedoc.json',
    outBase: 'platform/content/docs/react',
    version: JSON.parse(readFileSync(join(repoRoot, 'sdk/react/package.json'), 'utf8')).version,
  },
];

// Resource → Type names that belong in that file (mirrors legacy resources grouping)
const RESOURCE_MAP = {
  agents: ['Agent', 'AgentSocialLinks', 'AgentVisibility', 'AgentCategory', 'CreateAgentInput', 'UpdateAgentInput', 'DiscoverAgentsParams', 'McpConnection'],
  skills: ['Skill', 'SkillFile', 'CreateSkillInput', 'UpdateSkillInput', 'DiscoverSkillsParams'],
  knowledge: ['KnowledgeBase', 'KnowledgeDocument', 'CreateKnowledgeBaseInput', 'UpdateKnowledgeBaseInput', 'DiscoverKnowledgeBasesParams', 'UploadFileInput', 'UploadDocumentsResult', 'DeleteDocumentResult', 'KnowledgeSearchResult'],
  threads: ['Thread', 'CreateThreadInput', 'UpdateThreadInput', 'ListThreadsParams', 'ThreadMessages'],
  files: ['PersonaFile', 'UploadFilePayload', 'ListFilesParams'],
  memory: ['MemoryFile', 'MemoryAgentGroup', 'MemoryListResult', 'MemoryFileScopeParams', 'GetMemoryFileParams', 'WriteMemoryFileInput', 'DeleteMemoryFileParams'],
  stores: ['Store', 'StoreScope', 'StoreAccessMode', 'CreateStoreInput', 'UpdateStoreInput', 'DiscoverStoresParams', 'StoreFile', 'GetStoreFileParams', 'DeleteStoreFileParams', 'WriteStoreFileInput'],
  providers: ['Provider', 'CreateProviderInput', 'UpdateProviderInput', 'ProviderModel', 'ProviderTestConnectionResult'],
  mcp: ['Mcp', 'McpTransport', 'McpAuthType', 'McpAuthMode', 'McpTool', 'McpResourceSummary', 'McpResourceTemplate', 'McpOAuthConfig', 'McpOAuthInput', 'CreateMcpInput', 'UpdateMcpInput', 'DiscoverMcpsParams', 'McpTestConnectionResult', 'McpReadResourceResult', 'McpUserConnectionStatus'],
  workflows: ['Workflow', 'WorkflowNodeType', 'WorkflowTriggerType', 'WorkflowVisibility', 'WorkflowOwnerType', 'NodeOnErrorAction', 'NodeRetryPolicy', 'WorkflowNodeData', 'WorkflowNode', 'WorkflowEdge', 'WorkflowTrigger', 'WorkflowDraft', 'AgentSnapshot', 'WorkflowVersion', 'WorkflowRunStatus', 'NodeRunStatus', 'NodeRun', 'WorkflowUsage', 'WorkflowRun', 'CreateWorkflowInput', 'UpdateWorkflowInput', 'DiscoverWorkflowsParams', 'ListWorkflowRunsParams', 'ListWorkflowVersionsParams', 'RunWorkflowOptions', 'WorkflowRunResult', 'WorkflowStreamEvent'],
  chat: ['AguiEvent', 'EventType', 'ChatMessageInput', 'ChatResume', 'SendMessageOptions', 'ChatInterrupt', 'ChatResult', 'AGUI_SCHEMA_VERSION', 'ClarificationQuestion', 'HitlRequestPayload', 'McpAppPayload', 'PersonaRunErrorEvent'],
  voice: ['VoiceSessionInfo', 'VoiceSessionTicket', 'CreateVoiceSessionOptions'],
  'audit-logs': ['AuditLogEntry', 'ListAuditLogsParams'],
  'rest-tools': ['RestApiTool', 'RestToolMethod', 'RestToolAuthType', 'RestToolBodyMode', 'RestToolParamIn', 'RestToolParamType', 'RestToolParamRow', 'RestToolParamDescriptor', 'RestToolResponseMapping', 'CreateRestToolInput', 'UpdateRestToolInput', 'DiscoverRestToolsParams', 'RestToolTestResult', 'TestRestToolInput'],
};

const RESOURCE_INTRO = {
  agents: 'Agents are AI personas with a system prompt, provider, and tool attachments. Create them with a control-plane client (no `externalUserId`), then chat with them via a per-user client. `Agent` is the read shape; `CreateAgentInput`/`UpdateAgentInput` are the write shapes.',
  skills: 'Skills are reusable capabilities (file-backed) that agents can use. Manage them via the SDK and attach via `agents.create({ skills: [skillId] })`.',
  knowledge: 'Knowledge bases are RAG collections backed by Qdrant. Upload documents, search, and attach to agents.',
  threads: 'Threads scope messages, files, todos, and checkpoints to one conversation. Use `externalUserId` so threads belong to your user.',
  files: 'Files are user uploads (multipart `file` part) scoped to an optional `agentId`/`threadId`.',
  memory: 'Memory is a file-based store: `/memories/user/` (shared) and `/memories/agent/` (per user-agent). Agents read/write via `write_file`/`read_file`.',
  stores: 'Stores are named mount points agents can be assigned to — filesystem-backed alternative to `contextOverride` for larger reference material.',
  providers: 'Providers hold LLM credentials (API keys). Requires a Project Secret; `testConnection` and `getModels` verify them.',
  mcp: 'MCP connectors are Model Context Protocol servers (tools/resources). Supports OAuth `owner` vs `user` modes and `testConnection`/`callTool`.',
  workflows: 'Workflows are multi-agent DAGs compiled to LangGraph StateGraphs — `draft` (editable) + `publishedVersion` (immutable). Stream via AG-UI with `seq` for resume and `dryRun` for safe testing.',
  chat: 'Chat is AG-UI SSE streaming: `chat.stream` yields `TEXT_MESSAGE_CHUNK`/`TOOL_CALL_*`/`CUSTOM` events; `sendMessage` drains to `{ text, interrupt, error }`.',
  voice: 'Voice mints a Gemini Live ticket server-side, then the browser opens `new WebSocket(wsUrl)` directly to Persona.',
  'audit-logs': 'Audit logs are read-only, control-plane only — lifecycle events (credentials minted/revoked, membership, suspend/restore).',
  'rest-tools': 'REST tools are code-first tools via `defineRestTool` (zod) served as `GET {mountPath}/rest-tools/manifest` and discovered live as a Source.',
};

const RESOURCE_EXAMPLES = {
  agents: {
    ts: `import { PersonaClient } from '@personaai/sdk';\nconst persona = new PersonaClient({ baseUrl, credential: process.env.PERSONA_CREDENTIAL! });\nconst agent = await persona.agents.create({\n  name: 'Career Launchpad',\n  systemPrompt: 'You help students find internships.',\n  providerId: '...',\n  visibility: 'unlisted',\n});`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/agents \\\n  -H "Authorization: Bearer $PERSONA_CREDENTIAL" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Career Launchpad","systemPrompt":"You help students…","providerId":"...","visibility":"unlisted"}'`,
    json: `{\n  "success": true,\n  "data": { "_id": "ag_123", "name": "Career Launchpad", "slug": "career-launchpad", "isActive": true }\n}`,
  },
  skills: {
    ts: `const skill = await persona.skills.create({ name: 'Research', description: 'Web search' });\nawait persona.agents.create({ name: 'Analyst', systemPrompt: '...', providerId: '...', skills: [skill._id] });`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/skills \\\n  -H "Authorization: Bearer $PERSONA_CREDENTIAL" -H "Content-Type: application/json" \\\n  -d '{"name":"Research"}'`,
    json: `{\n  "success": true,\n  "data": { "_id": "sk_123", "name": "Research" }\n}`,
  },
  knowledge: {
    ts: `const kb = await persona.knowledge.create({ name: 'Docs', description: 'Product docs' });\nawait persona.knowledge.uploadDocuments(kb._id, [{ filename: 'guide.pdf', content: buf }]);\nconst { results } = await persona.knowledge.search(kb._id, 'pricing', { topK: 5 });`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/knowledge/KB_ID/documents \\\n  -H "Authorization: Bearer $PERSONA_CREDENTIAL" -F files=@guide.pdf`,
    json: `{\n  "success": true,\n  "data": { "results": [{ "sourceName": "guide.pdf", "score": 0.92 }] }\n}`,
  },
  threads: {
    ts: `const userClient = new PersonaClient({ baseUrl, credential, externalUserId: currentUser.id });\nconst thread = await userClient.threads.create({ agentId: agent._id });\nfor await (const e of userClient.chat.stream(agent._id, { messages: [{ role:'user', content:'Hi' }], threadId: thread._id })) {}\n`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/threads \\\n  -H "Authorization: Bearer $PERSONA_CREDENTIAL" -H "x-persona-external-user-id: user_123" \\\n  -H "Content-Type: application/json" -d '{"agentId":"ag_123"}'`,
    json: `{\n  "success": true,\n  "data": { "_id": "th_123", "agentId": "ag_123", "title": "New chat" }\n}`,
  },
  files: {
    ts: `const file = await userClient.files.upload({ filename: 'notes.pdf', content: buf, agentId: agent._id });\nconst list = await userClient.files.list({ page: 1, limit: 20 });`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/files \\\n  -H "Authorization: Bearer $PERSONA_CREDENTIAL" -H "x-persona-external-user-id: user_123" \\\n  -F file=@notes.pdf -F agentId=ag_123`,
    json: `{\n  "success": true,\n  "data": { "items": [{ "id": "file_123", "originalName": "notes.pdf" }], "pagination": { "total": 1 } }\n}`,
  },
  memory: {
    ts: `const list = await userClient.memory.list();\nawait userClient.memory.writeFile({ path: '/memories/user/preferences.md', content: '# Likes\\n- concise answers' });`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/memory/file?path=/memories/user/preferences.md \\\n  -H "Authorization: Bearer $PERSONA_CREDENTIAL" -H "x-persona-external-user-id: user_123"`,
    json: `{\n  "success": true,\n  "data": { "path": "/memories/user/preferences.md", "content": "# Likes" }\n}`,
  },
  stores: {
    ts: `const store = await persona.stores.create({ name: 'Handbook', scope: 'domain', accessMode: 'readwrite' });\nawait persona.stores.writeFile(store._id, { path: 'intro.md', content: '# Hello' });`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/stores \\\n  -H "Authorization: Bearer $PERSONA_CREDENTIAL" -H "Content-Type: application/json" \\\n  -d '{"name":"Handbook","scope":"domain"}'`,
    json: `{\n  "success": true,\n  "data": { "_id": "store_123", "name": "Handbook" }\n}`,
  },
  providers: {
    ts: `const provider = await persona.providers.create({ name: 'OpenAI', provider: 'openai', apiKey: 'sk-...' });\nawait persona.providers.testConnection(provider._id);`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/providers \\\n  -H "Authorization: Bearer $PERSONA_CREDENTIAL" -H "Content-Type: application/json" \\\n  -d '{"name":"OpenAI","provider":"openai","apiKey":"sk-..."}'`,
    json: `{\n  "success": true,\n  "data": { "_id": "prov_123", "provider": "openai" }\n}`,
  },
  mcp: {
    ts: `const mcp = await persona.mcps.create({ name: 'GitHub', transport: 'sse', url: 'https://mcp.github.com/sse' });\nawait persona.mcps.testConnection(mcp._id);`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/mcps \\\n  -H "Authorization: Bearer $PERSONA_CREDENTIAL" -H "Content-Type: application/json" \\\n  -d '{"name":"GitHub","transport":"sse","url":"https://mcp.github.com/sse"}'`,
    json: `{\n  "success": true,\n  "data": { "_id": "mcp_123", "name": "GitHub" }\n}`,
  },
  workflows: {
    ts: `const wf = await persona.workflows.create({ name: 'Research', draft: { nodes, edges, trigger: { type: 'manual' } } });\nconst result = await persona.workflows.run(wf._id, { input: { query: 'trends' } });\nfor await (const e of persona.workflows.stream(wf._id, { input: { query: '...' } })) {}`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/workflows/WF_ID/runs -H "Authorization: Bearer $PERSONA_CREDENTIAL" -H "Content-Type: application/json" -d '{"input":{"query":"trends"}}'`,
    json: `{\n  "success": true,\n  "data": { "runId": "run_123", "status": "completed", "output": { "summary": "..." } }\n}`,
  },
  chat: {
    ts: `for await (const e of userClient.chat.stream(agent._id, { messages: [{ role:'user', content:'Hi' }], threadId: thread._id })) {\n  if (e.type === 'TEXT_MESSAGE_CHUNK' && e.delta) process.stdout.write(e.delta);\n}\nconst result = await userClient.chat.sendMessage(agent._id, { messages: [{ role:'user', content:'Hi' }], threadId: thread._id });`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/agui -H "Authorization: Bearer $PERSONA_CREDENTIAL" -H "x-agent-id: ag_123" -H "x-thread-id: th_123" -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"Hi"}]}' # streams text/event-stream`,
    json: `{\n  "text": "Hello! How can I help?",\n  "events": [{ "type": "TEXT_MESSAGE_CHUNK", "delta": "Hello!" }]\n}`,
  },
  voice: {
    ts: `const { ticket, wsUrl } = await userClient.voice.createSession(agent._id);\nconst ws = new WebSocket(wsUrl); // ticket embedded`,
    curl: `curl -X POST https://api.persona.hasanraiyan.me/api/v1/developer/voice/sessions -H "Authorization: Bearer $PERSONA_CREDENTIAL" -H "x-persona-external-user-id: user_123" -H "Content-Type: application/json" -d '{"agentId":"ag_123"}'`,
    json: `{\n  "success": true,\n  "data": { "ticket": "tik_...", "wsUrl": "wss://voice.persona.../session?ticket=tik_..." }\n}`,
  },
  'audit-logs': {
    ts: `const { items } = await persona.auditLogs.list({ page: 1, limit: 20 });`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/audit-logs -H "Authorization: Bearer $PERSONA_CREDENTIAL"`,
    json: `{\n  "success": true,\n  "data": { "items": [{ "eventType": "credential.minted" }], "pagination": { "total": 1 } }\n}`,
  },
  'rest-tools': {
    ts: `import { defineRestTool } from '@personaai/sdk/rest-tools'; import { z } from 'zod';\nconst getProfile = defineRestTool({ name: 'Get learner', method: 'GET', args: z.object({ userId: z.string() }), url: t => \`https://api.example.com/users/\${t.arg('userId')}\` });`,
    curl: `curl https://api.persona.hasanraiyan.me/api/v1/developer/rest-tools -H "Authorization: Bearer $PERSONA_CREDENTIAL" | jq .`,
    json: `{\n  "success": true,\n  "data": { "items": [{ "name": "Get learner" }] }\n}`,
  },
};

function commentToText(comment) {
  if (!comment?.summary) return '';
  return comment.summary.map(p => {
    if (p.kind === 'code') return `\`${p.text}\``;
    return p.text;
  }).join('').replace(/\s+/g, ' ').trim();
}

function typeToString(t) {
  if (!t) return 'unknown';
  switch (t.type) {
    case 'intrinsic': return t.name;
    case 'reference': {
      const name = t.name;
      if (t.typeArguments?.length) {
        const args = t.typeArguments.map(typeToString).join(', ');
        return `${name}<${args}>`;
      }
      return name;
    }
    case 'array': return `${typeToString(t.elementType)}[]`;
    case 'union': return t.types.map(typeToString).join(' | ');
    case 'intersection': return t.types.map(typeToString).join(' & ');
    case 'typeOperator': return `${t.operator} ${typeToString(t.target)}`;
    case 'tuple': return `[${(t.elements||[]).map(typeToString).join(', ')}]`;
    case 'reflection': {
      // inline object — show as Record or { ... }
      if (t.declaration?.children) {
        const props = t.declaration.children.map(c => `${c.name}: ${typeToString(c.type)}`).join('; ');
        return `{ ${props} }`;
      }
      return 'object';
    }
    case 'literal': return JSON.stringify(t.value);
    case 'query': return `typeof ${typeToString(t.queryType)}`;
    default: return t.name || t.type || 'unknown';
  }
}

function buildTableForInterface(node) {
  const rows = [];
  for (const prop of node.children || []) {
    const name = prop.name + (prop.flags?.isOptional ? '?' : '');
    const typeStr = typeToString(prop.type);
    const desc = commentToText(prop.comment).replace(/\|/g, '\\|');
    const src = prop.sources?.[0] ? ` \`${prop.sources[0].fileName}:${prop.sources[0].line}\`` : '';
    rows.push(`| \`${name}\` | \`${typeStr.replace(/\|/g, '\\|')}\` | ${desc}${src ? ` — _${src}_` : ''} |`);
  }
  if (rows.length === 0) return '_No fields — type alias or empty interface._';
  return ['| Field | Type | Description |', '|---|---|---|', ...rows].join('\n');
}

function generateSdkResources() {
  const tdJsonPath = join(repoRoot, SDK.typedocJson);
  if (!existsSync(tdJsonPath)) {
    console.error(`[typedoc-resources] ${tdJsonPath} not found — run npx typedoc first`);
    process.exit(1);
  }
  const root = JSON.parse(readFileSync(tdJsonPath, 'utf8'));
  const byName = new Map();
  for (const mod of root.children || []) {
    for (const exp of mod.children || []) byName.set(exp.name, exp);
    if (mod.name && mod.kind === 256) byName.set(mod.name, mod);
  }
  for (const c of root.children || []) if (c.kind === 256 || c.kind === 4096) byName.set(c.name, c);

  const outDir = join(repoRoot, SDK.outBase, `v${SDK.version}`, 'resources');
  mkdirSync(outDir, { recursive: true });

  let count = 0;
  for (const [resource, typeNames] of Object.entries(RESOURCE_MAP)) {
    const found = typeNames.map(n => [n, byName.get(n)]).filter(([, node]) => !!node);
    if (found.length === 0) continue;
    const lines = [];
    lines.push(`---`);
    lines.push(`title: "${resource} — @personaai/sdk"`);
    lines.push(`description: "Generated field tables for ${resource} — do not edit"`);
    lines.push(`---`);
    lines.push(``);
    lines.push(`> **Generated from \`${SDK.typedocJson}\` — do not edit.** Regenerate with \`node platform/scripts/typedoc-resources.mjs\`.`);
    lines.push(``);
    lines.push(`# ${resource}`);
    lines.push(``);
    lines.push(`> **Auth:** Requires \`Authorization: Bearer <keyId>.<secret>\` (server-side). For per-user calls add \`x-persona-external-user-id\`. See [Credentials](/concepts/credentials).`);
    lines.push(``);
    if (RESOURCE_INTRO[resource]) { lines.push(RESOURCE_INTRO[resource]); lines.push(``); }
    if (RESOURCE_EXAMPLES[resource]) {
      const ex = RESOURCE_EXAMPLES[resource];
      lines.push(`## Example`);
      lines.push(``);
      lines.push(`**TypeScript**`);
      lines.push(``);
      lines.push('```ts');
      lines.push(ex.ts);
      lines.push('```');
      lines.push(``);
      lines.push(`**cURL**`);
      lines.push(``);
      lines.push('```bash');
      lines.push(ex.curl);
      lines.push('```');
      lines.push(``);
      lines.push(`**Response**`);
      lines.push(``);
      lines.push('```json');
      lines.push(ex.json);
      lines.push('```');
      lines.push(``);
      lines.push(`---`);
      lines.push(``);
    }
    for (const [name, node] of found) {
      lines.push(`## \`${name}\``);
      lines.push(``);
      const desc = commentToText(node.comment);
      if (desc) { lines.push(desc); lines.push(``); }
      if (node.sources?.[0]) lines.push(`_Source: \`${node.sources[0].fileName}:${node.sources[0].line}\`_`), lines.push(``);
      const kindLabel = node.kind === 256 ? 'Interface' : node.kind === 4194304 ? 'Type alias' : node.kind === 32 ? 'Variable' : `Kind ${node.kind}`;
      lines.push(`_${kindLabel}_`);
      lines.push(``);
      if (node.kind !== 256 || !node.children) {
        if (node.type) lines.push(`\`\`\`ts\ntype ${name} = ${typeToString(node.type)}\n\`\`\``), lines.push(``);
        else lines.push(`_No fields_`), lines.push(``);
      } else {
        lines.push(buildTableForInterface(node));
        lines.push(``);
      }
    }
    const outPath = join(outDir, `${resource}.mdx`);
    writeFileSync(outPath, lines.join('\n'));
    console.log(`[typedoc-resources] wrote ${resource}.mdx (${found.length} types)`);
    count++;
  }
  console.log(`[typedoc-resources] sdk: ${count} resource files at ${outDir}`);
}

function generatePerInterfaceForSdk(sdkCfg) {
  const tdJsonPath = join(repoRoot, sdkCfg.typedocJson);
  if (!existsSync(tdJsonPath)) {
    console.warn(`[typedoc-resources] ${sdkCfg.id}: ${tdJsonPath} not found — skipping`);
    return;
  }
  const root = JSON.parse(readFileSync(tdJsonPath, 'utf8'));
  const nodes = [];
  for (const mod of root.children || []) {
    if (mod.kind === 2 && mod.children) {
      for (const exp of mod.children) if (exp.kind === 256 || exp.kind === 4194304) nodes.push(exp);
    } else if (mod.kind === 256 || mod.kind === 4194304) {
      nodes.push(mod);
    }
  }
  // For flat runtime-style, root.children are already interfaces
  if (nodes.length === 0) {
    for (const c of root.children || []) if (c.kind === 256 || c.kind === 4194304) nodes.push(c);
  }
  // Deduplicate by name
  const byName = new Map();
  for (const n of nodes) if (!byName.has(n.name)) byName.set(n.name, n);

  const outDir = join(repoRoot, sdkCfg.outBase, `v${sdkCfg.version}`, 'types');
  mkdirSync(outDir, { recursive: true });
  let count = 0;
  for (const [name, node] of byName) {
    // Skip if already covered by sdk resources (avoid duplicate for sdk)
    if (sdkCfg.id === 'sdk') continue;
    const lines = [];
    lines.push(`---`);
    lines.push(`title: "${name} — @personaai/${sdkCfg.id}"`);
    lines.push(`description: "Generated field table for ${name} — do not edit"`);
    lines.push(`---`);
    lines.push(``);
    lines.push(`> **Generated from \`${sdkCfg.typedocJson}\` — do not edit.**`);
    lines.push(``);
    lines.push(`# \`${name}\``);
    lines.push(``);
    const desc = commentToText(node.comment);
    if (desc) { lines.push(desc); lines.push(``); }
    if (node.sources?.[0]) lines.push(`_Source: \`${node.sources[0].fileName}:${node.sources[0].line}\`_`), lines.push(``);
    const kindLabel = node.kind === 256 ? 'Interface' : node.kind === 4194304 ? 'Type alias' : `Kind ${node.kind}`;
    lines.push(`_${kindLabel}_`);
    lines.push(``);
    if (node.kind !== 256 || !node.children) {
      if (node.type) lines.push(`\`\`\`ts\ntype ${name} = ${typeToString(node.type)}\n\`\`\``), lines.push(``);
      else lines.push(`_No fields_`), lines.push(``);
    } else {
      lines.push(buildTableForInterface(node));
      lines.push(``);
    }
    const outPath = join(outDir, `${name}.mdx`);
    writeFileSync(outPath, lines.join('\n'));
    count++;
  }
  console.log(`[typedoc-resources] ${sdkCfg.id}: ${count} per-interface files at ${outDir}`);
}

function main() {
  generateSdkResources();
  for (const sdkCfg of OTHER_SDKS) generatePerInterfaceForSdk(sdkCfg);
}

main();
