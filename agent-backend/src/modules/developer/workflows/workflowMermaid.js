/**
 * Serializes a WorkflowDefinition (draft or published definition) to a Mermaid flowchart.
 * Echoes LangGraph's draw_mermaid() functionality.
 */

function sanitizeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitizeLabel(label) {
  return String(label).replace(/["\n\r]/g, ' ').trim();
}

function formatNodeMermaid(node) {
  const safeId = sanitizeId(node.id);
  const label = sanitizeLabel(node.data?.label || node.id);

  switch (node.type) {
    case 'trigger':
      return `${safeId}(["${label} (Trigger)"])`;
    case 'agentStep':
      return `${safeId}["${label} (Agent)"]`;
    case 'knowledgeStep':
      return `${safeId}[("${label} (Knowledge)")]`;
    case 'toolStep':
      return `${safeId}[["${label} (Tool)"]]`;
    case 'condition':
      return `${safeId}{"${label}?"}`;
    case 'approval':
      return `${safeId}[/"${label} (Approval)"/]`;
    case 'output':
      return `${safeId}(["${label} (Output)"])`;
    default:
      return `${safeId}["${label}"]`;
  }
}

/**
 * Generates standard Mermaid flowchart text.
 * @param {{ nodes?: Array, edges?: Array, draft?: { nodes: Array, edges: Array } }} workflowDef
 * @param {'TD'|'LR'} [direction='TD']
 * @returns {string} Mermaid markdown flowchart definition
 */
export function generateWorkflowMermaid(workflowDef, direction = 'TD') {
  const nodes = workflowDef?.draft?.nodes || workflowDef?.definition?.nodes || workflowDef?.nodes || [];
  const edges = workflowDef?.draft?.edges || workflowDef?.definition?.edges || workflowDef?.edges || [];

  const lines = [`flowchart ${direction}`];

  if (!nodes.length) {
    lines.push('  Empty["(Empty Workflow)"]');
    return lines.join('\n');
  }

  // Define nodes
  for (const node of nodes) {
    lines.push(`  ${formatNodeMermaid(node)}`);
  }

  // Define edges
  for (const edge of edges) {
    const fromId = sanitizeId(edge.source);
    const toId = sanitizeId(edge.target);
    const label = edge.conditionValue ? `|${sanitizeLabel(edge.conditionValue)}|` : '';
    lines.push(`  ${fromId} -->${label} ${toId}`);
  }

  return lines.join('\n');
}
