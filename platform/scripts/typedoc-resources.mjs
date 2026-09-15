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
