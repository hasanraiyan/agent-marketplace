'use client';

import { useState } from 'react';
import {
  AlertCircle,
  BotIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code,
  Edit,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  ListTodo,
  Loader2,
  Search,
  Cpu,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  tryParseJson,
  isTodoTool,
  isSkillTool,
  isAgentTool,
  parseTodos,
  isLsTool,
  isReadFileTool,
  parseLsResults,
  getReadFileToolDetails,
  getFileSystemActionDetails,
  toolTitle,
  searchResults,
  getDomain,
} from './utils';
import { TodoChecklist } from './TodoChecklist';
import { toast } from 'sonner';

export function ToolArguments({ argumentsText }) {
  if (!argumentsText) return null;
  const parsed = tryParseJson(argumentsText);
  if (!parsed || typeof parsed !== 'object') {
    return (
      <div className="text-xs font-mono bg-slate-100/50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800/60 leading-relaxed max-h-36 overflow-auto scrollbar-thin">
        {argumentsText}
      </div>
    );
  }

  const keys = Object.keys(parsed);
  if (keys.length === 1) {
    const key = keys[0];
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-850 dark:bg-slate-950 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
          {key.replace(/_/g, ' ')}
        </div>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {typeof parsed[key] === 'object' ? (
            <pre className="mt-1 font-mono text-xs bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 max-h-40 overflow-auto scrollbar-thin">
              {JSON.stringify(parsed[key], null, 2)}
            </pre>
          ) : (
            `"${String(parsed[key])}"`
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-850 dark:bg-slate-950 grid grid-cols-1 gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      {Object.entries(parsed).map(([key, val]) => (
        <div key={key} className="text-xs">
          <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
            {key.replace(/_/g, ' ')}
          </div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 break-words font-mono text-[11px] leading-relaxed">
            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
          </div>
        </div>
      ))}
    </div>
  );
}

function parseGrepResults(resultText) {
  if (!resultText) return [];

  try {
    const parsed = JSON.parse(resultText);
    const matches = Array.isArray(parsed) ? parsed : (parsed?.matches || parsed?.results);
    if (Array.isArray(matches)) {
      return matches.map((m) => {
        const file = m.Filename || m.filename || m.file || m.path || '';
        const line = m.LineNumber || m.lineNumber || m.line || 0;
        const content = m.LineContent || m.lineContent || m.content || '';
        return { file, line, content };
      }).filter((m) => m.file);
    }
  } catch (e) {
    // Fail silently, fallback to plain text parsing
  }

  const matches = [];
  const lines = resultText.split('\n');
  let currentFile = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.endsWith(':') && !/^\d+:/.test(line)) {
      currentFile = line.slice(0, -1).trim();
    } else if (currentFile) {
      const match = line.match(/^(\d+):(.*)$/);
      if (match) {
        const lineNum = parseInt(match[1], 10);
        const content = match[2];
        matches.push({
          file: currentFile,
          line: lineNum,
          content: content,
        });
      } else {
        matches.push({
          file: currentFile,
          line: 0,
          content: line,
        });
      }
    }
  }

  if (matches.length === 0) {
    return lines
      .map((l) => l.trim())
      .filter((l) => l && (l.startsWith('/') || l.includes('.') || l.includes('\\')))
      .map((l) => ({ file: l, line: 0, content: '' }));
  }

  return matches;
}

function escapeRegex(string) {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

function highlightMatch(text, query) {
  if (!query) return text;
  try {
    const escapedQuery = escapeRegex(query);
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark
              key={i}
              className="bg-yellow-100 text-slate-900 rounded-[2px] px-0.5 font-semibold dark:bg-yellow-500/35 dark:text-slate-100"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  } catch (err) {
    return text;
  }
}

function GrepResultsView({ tool, done }) {
  const parsedInput = tryParseJson(tool.argumentsText) || {};
  const query = parsedInput.pattern || parsedInput.Query || parsedInput.query || '';
  const path = parsedInput.path || parsedInput.SearchPath || parsedInput.searchPath || '/';
  const results = parseGrepResults(tool.resultText);

  // Group matches by file
  const fileGroups = {};
  for (const match of results) {
    if (!fileGroups[match.file]) {
      fileGroups[match.file] = [];
    }
    fileGroups[match.file].push(match);
  }

  const groupEntries = Object.entries(fileGroups);

  return (
    <div className="space-y-3">
      {/* Search Specs / Header Info */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Grep:</span>
        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2.5 py-0.5 font-bold text-blue-650 dark:bg-blue-950 dark:text-blue-400">
          <Search className="size-3" />
          &quot;{query}&quot;
        </span>
        <span className="text-slate-350 dark:text-slate-650">in</span>
        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-655 dark:bg-slate-800 dark:text-slate-400">
          {path}
        </span>
      </div>

      {/* Results List */}
      {done ? (
        groupEntries.length > 0 ? (
          <div className="max-h-60 overflow-auto space-y-2.5 scrollbar-thin pr-1">
            {groupEntries.map(([filePath, matches]) => {
              const fileName = filePath.split('/').pop() || filePath;
              const fileExt = fileName.includes('.')
                ? fileName.split('.').pop()?.toUpperCase()
                : 'FILE';
              const isCode = ['JS', 'JSX', 'TS', 'TSX', 'JSON', 'HTML', 'CSS', 'PY', 'SH', 'GO', 'RS', 'MD'].includes(fileExt);
              const FileIcon = isCode ? FileCode : FileText;

              return (
                <div key={filePath} className="rounded-xl border border-slate-150 bg-white dark:border-slate-800/80 dark:bg-slate-950 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  {/* File group header */}
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-3 py-1.5 dark:border-slate-850 dark:bg-slate-900/40">
                    <FileIcon className="size-3.5 text-slate-450 dark:text-slate-550" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-205">
                      {filePath}
                    </span>
                    <span className="ml-auto rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-850 dark:text-slate-450">
                      {matches.length} {matches.length === 1 ? 'match' : 'matches'}
                    </span>
                  </div>

                  {/* Matching lines */}
                  <div className="divide-y divide-slate-50 dark:divide-slate-850 font-mono text-[11px] leading-relaxed">
                    {matches.map((match, i) => (
                      <div key={i} className="flex hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        {/* Line number column */}
                        {match.line > 0 && (
                          <div className="w-9 shrink-0 select-none border-r border-slate-100 py-1.5 pr-2.5 text-right font-bold text-slate-400 dark:border-slate-850 dark:text-slate-600">
                            {match.line}
                          </div>
                        )}
                        {/* Match content */}
                        <div className="flex-1 py-1.5 pl-3 pr-2 whitespace-pre-wrap break-all text-slate-650 dark:text-slate-300">
                          {highlightMatch(match.content, query)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-500 dark:text-slate-400 italic">
            No matches found.
          </div>
        )
      ) : (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            Grep Searching...
          </div>
          <div className="h-8 rounded-xl bg-slate-105 dark:bg-slate-800/40 animate-pulse" />
        </div>
      )}
    </div>
  );
}

function LsDirectoryCard({ tool }) {
  const args = tryParseJson(tool.argumentsText) || {};
  const path = args.path || args.dir || args.directory || '/';
  const items = parseLsResults(tool.resultText);
  const done = tool.status === 'completed';

  return (
    <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
      {/* Directory Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3.5 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <Folder className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                {path}
              </span>
              <span className="shrink-0 rounded bg-slate-105 px-1 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                LIST
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Directory Contents */}
      {!done ? (
        <div className="flex flex-col items-center justify-center p-5 text-center text-slate-400 dark:text-slate-500">
          <Loader2 className="size-6 animate-spin mb-1.5 opacity-55 text-blue-500" />
          <span className="text-[11px] font-semibold">Listing Directory Contents...</span>
        </div>
      ) : items.length > 0 ? (
        <div className="max-h-56 overflow-auto divide-y divide-slate-100 dark:divide-slate-800/60 scrollbar-thin">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {item.isDir ? (
                  <Folder className="size-4 shrink-0 text-amber-500" />
                ) : (
                  <FileText className="size-4 shrink-0 text-slate-450 dark:text-slate-500" />
                )}
                <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">
                  {item.name}
                </span>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider',
                  item.isDir
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {item.isDir ? 'dir' : 'file'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-5 text-center text-slate-450 dark:text-slate-500">
          <FolderOpen className="size-7 mb-1.5 opacity-55 text-slate-450 dark:text-slate-500" />
          <span className="text-[11px] font-bold">Empty Directory</span>
        </div>
      )}
    </div>
  );
}

function ReadFileCard({ tool }) {
  const details = getReadFileToolDetails(tool);
  const [copied, setCopied] = useState(false);

  if (!details) {
    return (
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-600 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800/60 scrollbar-thin">
        {tool.resultText || 'No result yet.'}
      </pre>
    );
  }

  const { filePath, content, otherArgs } = details;
  const fileName = filePath.split('/').pop() || filePath;
  const folderPath = filePath.includes('/')
    ? filePath.substring(0, filePath.lastIndexOf('/') + 1)
    : '';
  const fileExt = fileName.includes('.')
    ? fileName.split('.').pop()?.toUpperCase()
    : 'FILE';

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied file content');
  };

  const isCode = ['JS', 'JSX', 'TS', 'TSX', 'JSON', 'HTML', 'CSS', 'PY', 'SH', 'GO', 'RS', 'MD'].includes(fileExt);
  const FileIcon = isCode ? FileCode : FileText;

  const lines = content ? content.split('\n') : [];
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  const done = tool.status === 'completed';

  return (
    <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
      {/* File Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3.5 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <FileIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                {fileName}
              </span>
              <span className="shrink-0 rounded bg-indigo-50 px-1 py-0.5 text-[9px] font-bold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                {fileExt}
              </span>
              <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                READ
              </span>
            </div>
            {folderPath && (
              <div className="truncate text-[10px] font-medium text-slate-450 dark:text-slate-500">
                {folderPath}
              </div>
            )}
          </div>
        </div>

        {done && content && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="size-7 rounded-md text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-350"
            title="Copy content"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Code className="size-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* File Content / Code Preview */}
      {!done ? (
        <div className="flex flex-col items-center justify-center p-5 text-center text-slate-400 dark:text-slate-500">
          <Loader2 className="size-6 animate-spin mb-1.5 opacity-55 text-indigo-500" />
          <span className="text-[11px] font-semibold">Reading File Content...</span>
        </div>
      ) : content ? (
        <div className="relative max-h-56 overflow-auto bg-slate-950 font-mono text-[11px] text-slate-100 dark:bg-slate-950/90 scrollbar-thin">
          <div className="flex min-w-full">
            {/* Line Numbers */}
            <div className="w-9 shrink-0 select-none border-r border-slate-800/80 bg-slate-900/10 py-2.5 text-right pr-2 text-[10px] font-bold text-slate-600 dark:text-slate-600">
              {lines.map((_, i) => (
                <div key={i} className="h-4.5 leading-4.5">
                  {i + 1}
                </div>
              ))}
            </div>
            {/* Code Lines */}
            <div className="flex-1 py-2.5 pl-2.5 pr-3 overflow-x-auto">
              {lines.map((line, i) => (
                <pre key={i} className="h-4.5 leading-4.5 whitespace-pre font-mono text-slate-300 dark:text-slate-200">
                  {line || ' '}
                </pre>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-5 text-center text-slate-450 dark:text-slate-500">
          <FileText className="size-7 mb-1.5 opacity-55" />
          <span className="text-[11px] font-bold">Empty File or No Content</span>
        </div>
      )}

      {/* Metadata / Other Args */}
      {Object.keys(otherArgs).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 bg-slate-50/20 px-3.5 py-2 dark:border-slate-800/80">
          {Object.entries(otherArgs).map(([key, val]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              <span className="text-slate-400 dark:text-slate-500 uppercase tracking-tight">{key.replace(/_/g, ' ')}:</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">
                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function FileSystemActionCard({ action }) {
  const details = getFileSystemActionDetails(action);
  const [copied, setCopied] = useState(false);

  if (!details) return null;

  const { filePath, content, hasContent, otherArgs } = details;
  const fileName = filePath.split('/').pop() || filePath;
  const folderPath = filePath.includes('/')
    ? filePath.substring(0, filePath.lastIndexOf('/') + 1)
    : '';
  const fileExt = fileName.includes('.')
    ? fileName.split('.').pop()?.toUpperCase()
    : 'FILE';

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied file content');
  };

  const isCode = ['JS', 'JSX', 'TS', 'TSX', 'JSON', 'HTML', 'CSS', 'PY', 'SH', 'GO', 'RS', 'MD'].includes(fileExt);
  const FileIcon = isCode ? FileCode : FileText;

  const lines = content.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
      {/* File Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3.5 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <FileIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                {fileName}
              </span>
              <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {fileExt}
              </span>
            </div>
            {folderPath && (
              <div className="truncate text-[10px] font-medium text-slate-450 dark:text-slate-500">
                {folderPath}
              </div>
            )}
          </div>
        </div>

        {hasContent && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="size-7 rounded-md text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-350"
            title="Copy content"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Code className="size-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* File Content / Code Preview */}
      {hasContent ? (
        <div className="relative max-h-56 overflow-auto bg-slate-950 font-mono text-[11px] text-slate-100 dark:bg-slate-950/90 scrollbar-thin">
          <div className="flex min-w-full">
            {/* Line Numbers */}
            <div className="w-9 shrink-0 select-none border-r border-slate-800/80 bg-slate-900/10 py-2.5 text-right pr-2 text-[10px] font-bold text-slate-600 dark:text-slate-600">
              {lines.map((_, i) => (
                <div key={i} className="h-4.5 leading-4.5">
                  {i + 1}
                </div>
              ))}
            </div>
            {/* Code Lines */}
            <div className="flex-1 py-2.5 pl-2.5 pr-3 overflow-x-auto">
              {lines.map((line, i) => (
                <pre key={i} className="h-4.5 leading-4.5 whitespace-pre font-mono text-slate-300 dark:text-slate-200">
                  {line || ' '}
                </pre>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-5 text-center text-slate-450 dark:text-slate-500">
          <FileText className="size-7 mb-1.5 opacity-55" />
          <span className="text-[11px] font-bold">Empty File</span>
        </div>
      )}

      {/* Metadata / Other Args */}
      {Object.keys(otherArgs).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 bg-slate-50/20 px-3.5 py-2 dark:border-slate-800/80">
          {Object.entries(otherArgs).map(([key, val]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              <span className="text-slate-400 dark:text-slate-500 uppercase tracking-tight">{key.replace(/_/g, ' ')}:</span>
              <span className="font-mono text-slate-600 dark:text-slate-350">
                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActionArguments({ args }) {
  if (!args || typeof args !== 'object' || Object.keys(args).length === 0) return null;

  const entries = Object.entries(args);
  if (entries.length === 1) {
    const [key, val] = entries[0];
    return (
      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 dark:border-slate-800/80 dark:bg-slate-900/30">
        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {key.replace(/_/g, ' ')}
        </div>
        <div className="mt-1 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
          {typeof val === 'object' ? (
            <pre className="max-h-32 overflow-auto text-[10px] leading-relaxed scrollbar-thin">
              {JSON.stringify(val, null, 2)}
            </pre>
          ) : (
            String(val)
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-1 gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 dark:border-slate-800/80 dark:bg-slate-900/30">
      {entries.map(([key, val]) => (
        <div key={key} className="text-xs">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {key.replace(/_/g, ' ')}
          </div>
          <div className="mt-0.5 break-words font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToolTrace({ tool }) {
  const [open, setOpen] = useState(false);
  const done = tool.status === 'completed';
  const results = searchResults(tool);
  const parsedResult = tryParseJson(tool.resultText);
  const isError = parsedResult?.status === 'error';
  const isSearch = tool.name?.toLowerCase().includes('search');
  const isGrep = tool.name?.toLowerCase().includes('grep');
  const isTodo = isTodoTool(tool.name);
  const isSkill = isSkillTool(tool.name);
  const isAgent = isAgentTool(tool.name);
  const todos = isTodo ? parseTodos(tool.argumentsText, tool.resultText) : null;
  const todosDone = todos
    ? todos.filter((todo) => todo.status === 'completed').length
    : 0;
  const isExpandable = Boolean(tool.resultText || tool.argumentsText);
  const Icon = isError
    ? AlertCircle
    : isSearch
      ? Globe
      : isGrep
        ? Search
        : isTodo
          ? ListTodo
          : isSkill
            ? Cpu
            : isAgent
              ? BotIcon
              : tool.name?.includes('file')
                ? FileText
                : Wrench;

  return (
    <div className="max-w-[92%]">
      <button
        type="button"
        onClick={() => isExpandable && setOpen((value) => !value)}
        className="group flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span className="flex w-6 shrink-0 justify-center pt-0.5">
          <Icon
            className={cn(
              'size-[18px]',
              isError
                ? 'text-red-500'
                : done
                  ? 'text-slate-400'
                  : 'animate-pulse text-orange-500',
            )}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {toolTitle(tool)}
            </span>
            {isExpandable ? (
              open ? (
                <ChevronUp className="size-4 text-slate-400" />
              ) : (
                <ChevronDown className="size-4 text-slate-400" />
              )
            ) : null}
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-medium',
                isError
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                  : 'bg-[#1E60FF]/10 text-[#1E60FF]',
              )}
            >
              {isError
                ? 'Failed'
                : isTodo && todos
                  ? `${todosDone}/${todos.length} done`
                  : isSearch && done && results.length
                    ? `${results.length} results`
                    : isGrep && done
                      ? `${parseGrepResults(tool.resultText).length} matches`
                      : done
                        ? 'Result'
                        : 'Running'}
            </span>
          </span>
        </span>
      </button>

      {isError ? (
        <div className="ml-8 mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {parsedResult.message || 'The tool call failed.'}
        </div>
      ) : null}

      {open ? (
        <div className="ml-8 mt-1 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-900/70">
          {/* Tool Inputs */}
          {tool.argumentsText && !isTodo && !isGrep && (
            <ToolArguments argumentsText={tool.argumentsText} />
          )}

          {/* Tool Outputs / Status */}
          {isSkill && done && !isError ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="size-4" />
                Skill Successfully {tryParseJson(tool.argumentsText)?.action === 'delete' ? 'Deleted' : 'Saved'}
              </div>
              {tryParseJson(tool.argumentsText)?.action !== 'delete' && (
                <Link href={`/dashboard/skills?id=${parsedResult?.data?._id || parsedResult?.data?.id}`}>
                  <Button size="sm" variant="outline" className="w-full">
                    <Edit className="mr-2 size-3.5" />
                    View or Edit Skill
                  </Button>
                </Link>
              )}
            </div>
          ) : isAgent && done && !isError ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="size-4" />
                Agent Successfully Saved
              </div>
              <Link href={`/dashboard/agents/${parsedResult?.data?._id || parsedResult?.data?.id}`}>
                <Button size="sm" variant="outline" className="w-full">
                  <BotIcon className="mr-2 size-3.5" />
                  View Agent Details
                </Button>
              </Link>
            </div>
          ) : isGrep ? (
            <GrepResultsView tool={tool} done={done} />
          ) : todos ? (
            <TodoChecklist todos={todos} showProgress={true} />
          ) : isSearch ? (
            done ? (
              results.length ? (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    Search Results
                  </div>
                  <div className="max-h-48 overflow-auto space-y-1.5 scrollbar-thin">
                    {results.map((result, index) => (
                      <a
                        key={result.url || index}
                        href={result.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 hover:border-blue-500 hover:bg-blue-50/10 dark:border-slate-800/60 dark:bg-slate-950 dark:hover:border-blue-500/30 dark:hover:bg-blue-950/10 transition-all duration-200"
                      >
                        <img
                          src={`https://www.google.com/s2/favicons?sz=32&domain=${getDomain(result.url || '')}`}
                          alt=""
                          className="size-3.5 shrink-0 rounded-sm"
                        />
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-300 text-xs">
                          {result.title || result.url}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border">
                          {getDomain(result.url || '')}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  No search results found.
                </div>
              )
            ) : (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                  Searching Results...
                </div>
                <div className="space-y-2 animate-pulse">
                  <div className="h-8 rounded-xl bg-slate-105 dark:bg-slate-800/40" />
                  <div className="h-8 rounded-xl bg-slate-105 dark:bg-slate-800/40" />
                </div>
              </div>
            )
          ) : isLsTool(tool.name) ? (
            <LsDirectoryCard tool={tool} />
          ) : isReadFileTool(tool.name) ? (
            <ReadFileCard tool={tool} />
          ) : (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                Output Result
              </div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-600 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800/60 scrollbar-thin">
                {tool.resultText || 'No result yet.'}
              </pre>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
