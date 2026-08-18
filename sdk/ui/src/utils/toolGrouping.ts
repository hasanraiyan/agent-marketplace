import type { ComponentType } from 'react';
import type { PersonaToolCall } from '@personaai/react';

export interface PersonaToolClusterMeta {
  title: string;
  icon?: ComponentType<{ className?: string }>;
}

/** Keyed by `toolGroupKey`'s return value — `mixed` is the fallback when a group's tools don't share one key. */
export type PersonaToolClusterLabels = Record<string, PersonaToolClusterMeta>;

function safeParseArgs(args: string | undefined): Record<string, unknown> {
  if (!args) return {};
  try {
    const parsed = JSON.parse(args);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Which semantic family a tool belongs to, for the cluster header. Memory is
 * detected by name AND by file ops touching /memories/ paths, matching how
 * persona.hasanraiyan.me's own frontend classifies tools for the same purpose.
 */
export function toolGroupKey(tool: PersonaToolCall): string {
  const name = tool.toolName.toLowerCase();
  if (name.includes('memory') || name.includes('preference')) return 'memory';
  const args = safeParseArgs(tool.args);
  const path = (args.file_path ?? args.path ?? args.filePath ?? '') as unknown;
  if (typeof path === 'string' && path.includes('/memories')) return 'memory';
  if (name.includes('file') || name === 'ls' || name === 'glob' || name === 'grep') return 'file';
  if (name.includes('search') || name.startsWith('tavily')) return 'search';
  if (name === 'task') return 'task';
  if (name.includes('todo')) return 'plan';
  return name;
}

export interface PersonaToolGroupItem {
  type: 'single' | 'group';
  tools: PersonaToolCall[];
}

/**
 * Clusters consecutive tool calls from one message into groups a
 * `PersonaToolGroup` can render as one collapsible unit, instead of one card
 * per call. `present_file` never joins a group — its whole purpose is
 * "highlight this file", which a generic "N steps" cluster header would bury.
 */
export function groupToolCalls(toolCalls: PersonaToolCall[]): PersonaToolGroupItem[] {
  const items: PersonaToolGroupItem[] = [];
  let buffer: PersonaToolCall[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    items.push({ type: buffer.length === 1 ? 'single' : 'group', tools: buffer });
    buffer = [];
  };

  for (const tool of toolCalls) {
    if (tool.toolName === 'present_file') {
      flush();
      items.push({ type: 'single', tools: [tool] });
    } else {
      buffer.push(tool);
    }
  }
  flush();
  return items;
}
