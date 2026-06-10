'use client';

import { FileCode, FileText, Search } from 'lucide-react';
import { tryParseJson } from '../utils';

export function parseGrepResults(resultText) {
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

export function GrepResultsView({ tool, done }) {
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
                <div key={filePath} className="rounded-xl border border-slate-150 bg-white dark:border-slate-800/80 dark:bg-slate-950 overflow-hidden">
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
