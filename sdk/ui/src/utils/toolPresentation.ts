import type { ComponentType } from 'react';
import { BookText, Bot, FileText, Globe, ListTodo, Search, Wrench } from 'lucide-react';

/**
 * Humanized titles + semantic icons + result parsing for the built-in tools
 * every deepagents-based persona ships with (file ops, web/KB search, grep,
 * todos, subagents). Ported from persona.hasanraiyan.me's own frontend
 * (frontend/src/components/agents/agui/utils.js's toolTitle/subToolIcon and
 * the tool-cards/*.jsx result parsers) so sdk/ui's generic tool trace gets
 * the same per-tool presentation instead of a raw tool name + JSON dump.
 */

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function firstString(args: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string' && value) return value;
  }
  return '';
}

export function isWebSearchTool(name: string): boolean {
  const n = name.toLowerCase();
  return n === 'search_web' || n.includes('google') || n.startsWith('tavily');
}

export function isKbSearchTool(name: string): boolean {
  const n = name.toLowerCase();
  return !isWebSearchTool(name) && (n === 'search_knowledge_base' || (n.startsWith('search_') && n !== 'search_web'));
}

export function isKbListSourcesTool(name: string): boolean {
  const n = name.toLowerCase();
  return n === 'list_knowledge_base_sources' || n.startsWith('list_sources_');
}

export function isGrepTool(name: string): boolean {
  return name.toLowerCase().includes('grep');
}

export function isReadFileTool(name: string): boolean {
  const n = name.toLowerCase();
  return n === 'read_file' || n === 'view_file' || n.includes('read_file') || n.includes('view_file');
}

export function isLsTool(name: string): boolean {
  const n = name.toLowerCase();
  return n === 'ls' || n === 'list_dir' || n === 'list_directory' || n.includes('list_dir') || n.includes('list_directory');
}

export function isFileWriteTool(name: string): boolean {
  return name.toLowerCase() === 'write_file';
}

export function isFileEditTool(name: string): boolean {
  return name.toLowerCase() === 'edit_file';
}

export function isSubagentTool(name: string): boolean {
  return name.toLowerCase() === 'task';
}

export function getToolIcon(toolName: string): ComponentType<{ className?: string }> {
  const n = toolName.toLowerCase();
  if (isWebSearchTool(toolName)) return Globe;
  if (isKbSearchTool(toolName) || isKbListSourcesTool(toolName)) return BookText;
  if (isGrepTool(toolName)) return Search;
  if (n.includes('todo')) return ListTodo;
  if (isSubagentTool(toolName)) return Bot;
  if (isReadFileTool(toolName) || isLsTool(toolName) || isFileWriteTool(toolName) || isFileEditTool(toolName) || n.includes('file')) {
    return FileText;
  }
  return Wrench;
}

export function queryFromArgs(args: unknown): string {
  const record = asRecord(args);
  const value = firstString(record, ['query', 'q', 'search_query', 'text', 'input']);
  return value;
}

export function getToolTitle(toolName: string, args: unknown, status: 'running' | 'completed'): string {
  const done = status === 'completed';
  const query = queryFromArgs(args);
  const record = asRecord(args);

  if (isWebSearchTool(toolName)) {
    if (query) return done ? `Searched the web for "${query}"` : `Searching the web for "${query}"`;
    return done ? 'Searched the web' : 'Searching the web';
  }

  if (isKbSearchTool(toolName) || isKbListSourcesTool(toolName)) {
    const kbName = firstString(record, ['knowledgeBaseName']) || 'Knowledge Base';
    const isSearch = !isKbListSourcesTool(toolName);
    const kbQuery = firstString(record, ['query']) || query;
    if (isSearch) {
      if (kbQuery) return done ? `Searched knowledge base "${kbName}" for "${kbQuery}"` : `Searching knowledge base "${kbName}" for "${kbQuery}"`;
      return done ? `Searched knowledge base "${kbName}"` : `Searching knowledge base "${kbName}"`;
    }
    return done ? `Listed documents in "${kbName}"` : `Listing documents in "${kbName}"`;
  }

  if (toolName.toLowerCase().includes('todo')) {
    return done ? 'Updated the plan' : 'Updating the plan';
  }

  if (isReadFileTool(toolName)) {
    return done ? 'Read file' : 'Reading file';
  }

  if (isLsTool(toolName)) {
    return done ? 'Listed directory' : 'Listing directory';
  }

  if (isSubagentTool(toolName)) {
    const subagentType = firstString(record, ['subagent_type']);
    const label = subagentType ? `${subagentType} subagent` : 'subagent';
    return done ? `Ran ${label}` : `Running ${label}`;
  }

  if (toolName.toLowerCase().includes('file') || toolName.toLowerCase() === 'glob') {
    return done ? 'Updated files' : 'Working with files';
  }

  return toolName
    .split(/[_\-\s]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export interface PersonaSearchResult {
  title?: string;
  url?: string;
}

export function searchResults(result: unknown): PersonaSearchResult[] {
  if (Array.isArray(result)) return result as PersonaSearchResult[];
  const record = asRecord(result);
  if (Array.isArray(record.results)) return record.results as PersonaSearchResult[];
  return [];
}

export interface PersonaLsEntry {
  name: string;
  isDir: boolean;
}

export function parseLsResults(result: unknown): PersonaLsEntry[] {
  if (Array.isArray(result)) {
    return (result as unknown[]).map((item) => {
      if (typeof item === 'string') {
        const isDir = item.endsWith('/') || item.includes('(directory)');
        return { name: item.replace(/\(directory\)/g, '').trim(), isDir };
      }
      const record = asRecord(item);
      return {
        name: String(record.name ?? record.path ?? ''),
        isDir: Boolean(record.isDir ?? record.is_dir ?? record.isDirectory),
      };
    });
  }

  if (typeof result !== 'string' || !result) return [];

  return result
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const isDir = line.endsWith('/') || line.toLowerCase().includes('(directory)') || line.toLowerCase().includes('(dir)');
      const name = line.replace(/\(directory\)/gi, '').replace(/\(dir\)/gi, '').trim();
      return { name, isDir };
    });
}

export interface PersonaGrepMatch {
  file: string;
  line: number;
  content: string;
}

export function parseGrepResults(result: unknown): PersonaGrepMatch[] {
  const record = Array.isArray(result) ? { matches: result } : asRecord(result);
  const matches = Array.isArray(record.matches) ? record.matches : Array.isArray(record.results) ? record.results : null;
  if (Array.isArray(matches)) {
    return matches
      .map((m) => {
        const row = asRecord(m);
        return {
          file: String(row.Filename ?? row.filename ?? row.file ?? row.path ?? ''),
          line: Number(row.LineNumber ?? row.lineNumber ?? row.line ?? 0),
          content: String(row.LineContent ?? row.lineContent ?? row.content ?? ''),
        };
      })
      .filter((m) => m.file);
  }

  if (typeof result !== 'string' || !result) return [];

  const out: PersonaGrepMatch[] = [];
  const lines = result.split('\n');
  let currentFile = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.endsWith(':') && !/^\d+:/.test(line)) {
      currentFile = line.slice(0, -1).trim();
    } else if (currentFile) {
      const match = line.match(/^(\d+):(.*)$/);
      if (match) {
        out.push({ file: currentFile, line: parseInt(match[1], 10), content: match[2] });
      } else {
        out.push({ file: currentFile, line: 0, content: line });
      }
    }
  }

  if (out.length === 0) {
    return lines
      .map((l) => l.trim())
      .filter((l) => l && (l.startsWith('/') || l.includes('.') || l.includes('\\')))
      .map((l) => ({ file: l, line: 0, content: '' }));
  }

  return out;
}

export type DiffRow = { type: 'context' | 'add' | 'remove'; line: string };

// Bounded LCS diff: falls back to naive remove-then-add when either side is
// too large for O(n*m) DP to stay fast (matches the reference's 250k cap).
export function computeLineDiff(oldLines: string[], newLines: string[]): DiffRow[] {
  const n = oldLines.length;
  const m = newLines.length;
  if (n * m > 250000) {
    return [
      ...oldLines.map((line) => ({ type: 'remove' as const, line })),
      ...newLines.map((line) => ({ type: 'add' as const, line })),
    ];
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      rows.push({ type: 'context', line: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'remove', line: oldLines[i] });
      i++;
    } else {
      rows.push({ type: 'add', line: newLines[j] });
      j++;
    }
  }
  while (i < n) rows.push({ type: 'remove', line: oldLines[i++] });
  while (j < m) rows.push({ type: 'add', line: newLines[j++] });
  return rows;
}

export interface PersonaDiffStats {
  added: number;
  removed: number;
}

// Line counts for the row's "+N -N" diffstat badge. Returns null when the
// args aren't parseable (yet) — the caller falls back to the generic panel.
export function computeFileDiffStats(toolName: string, args: unknown): PersonaDiffStats | null {
  const record = asRecord(args);

  if (isFileWriteTool(toolName)) {
    if (typeof record.content !== 'string') return null;
    return { added: record.content.split('\n').length, removed: 0 };
  }

  if (isFileEditTool(toolName)) {
    if (typeof record.old_string !== 'string' && typeof record.new_string !== 'string') return null;
    const rows = computeLineDiff(
      String(record.old_string ?? '').split('\n'),
      String(record.new_string ?? '').split('\n')
    );
    return {
      added: rows.filter((r) => r.type === 'add').length,
      removed: rows.filter((r) => r.type === 'remove').length,
    };
  }

  return null;
}

export function getFilePathFromArgs(args: unknown): string {
  const record = asRecord(args);
  return firstString(record, ['file_path', 'filePath', 'path', 'filename', 'fileName', 'targetFile', 'target_file']);
}
