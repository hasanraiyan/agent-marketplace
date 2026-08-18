'use client';

import React, { useMemo } from 'react';
import { FileCode, FileText, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn.js';

export interface PersonaReadFileCardProps {
  filePath: string;
  content: string;
  status: 'running' | 'completed';
  lineOffset?: number;
  className?: string;
}

const CODE_EXTENSIONS = new Set(['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'py', 'sh', 'go', 'rs', 'md', 'yaml', 'yml']);

// Some read_file tools return content already prefixed with "   1  <line>"
// line numbers; strip that and use the real numbers instead of re-numbering
// from 1, otherwise fall back to numbering from `lineOffset`.
function processLines(content: string, lineOffset: number) {
  if (!content) return { lines: [] as string[], lineNumbers: [] as number[] };
  const rawLines = content.split('\n');
  if (rawLines.length > 1 && rawLines[rawLines.length - 1] === '') rawLines.pop();

  const regex = /^\s*(\d+)(?:\s+(.*)|$)/;
  let isPrefixed = true;
  for (const line of rawLines) {
    if (line.trim() === '') continue;
    if (!regex.test(line)) {
      isPrefixed = false;
      break;
    }
  }

  if (isPrefixed && rawLines.length > 0) {
    const cleaned: string[] = [];
    const numbers: number[] = [];
    let lastNum = 0;
    for (const line of rawLines) {
      const match = line.match(regex);
      if (match) {
        cleaned.push(match[2] || '');
        lastNum = parseInt(match[1], 10);
        numbers.push(lastNum);
      } else {
        cleaned.push(line);
        lastNum += 1;
        numbers.push(lastNum);
      }
    }
    return { lines: cleaned, lineNumbers: numbers };
  }

  return { lines: rawLines, lineNumbers: rawLines.map((_, i) => lineOffset + i + 1) };
}

export function PersonaReadFileCard({ filePath, content, status, lineOffset = 0, className }: PersonaReadFileCardProps) {
  const { lines, lineNumbers } = useMemo(() => processLines(content, lineOffset), [content, lineOffset]);
  const done = status === 'completed';

  const fileName = filePath.split('/').pop() || filePath;
  const fileExt = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
  const isCode = fileExt ? CODE_EXTENSIONS.has(fileExt) : false;
  const FileIcon = isCode ? FileCode : FileText;

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#fff)] dark:border-zinc-800 dark:bg-zinc-950', className)}>
      <div className="flex items-center gap-2.5 border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/70 px-3.5 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/40">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
          <FileIcon className="size-4" />
        </div>
        <span className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">{filePath}</span>
      </div>

      {!done ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-400 dark:text-zinc-500">
          <Loader2 className="mb-2 size-6 animate-spin text-indigo-500 opacity-70" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Reading file content...</span>
        </div>
      ) : content ? (
        <div className="relative max-h-72 overflow-auto border-t border-[var(--persona-border,#e4e4e7)] bg-[#0D1117] font-mono text-[11.5px] text-[#C9D1D9] dark:border-zinc-850">
          <div className="flex min-w-full">
            <div className="w-10 shrink-0 select-none border-r border-[#30363D] bg-[#161B22]/50 py-3 pr-3 text-right text-[10px] font-bold text-[#8B949E]">
              {lineNumbers.map((num, i) => (
                <div key={i} className="h-5 leading-5">
                  {num}
                </div>
              ))}
            </div>
            <div className="flex-1 select-text overflow-x-auto py-3 pl-3 pr-4">
              {lines.map((line, i) => (
                <pre key={i} className="h-5 whitespace-pre font-mono leading-5 text-[#E6EDF2]">
                  {line || ' '}
                </pre>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-400 dark:text-zinc-500">
          <FileText className="mb-2 size-8 opacity-40" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Empty file or no content</span>
        </div>
      )}

      {done && content && (
        <div className="flex items-center justify-between border-t border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/50 px-4 py-2 text-[10px] font-bold uppercase tracking-tight text-zinc-400 dark:border-zinc-800/80 dark:bg-zinc-900/20 dark:text-zinc-500">
          <div>
            Showing lines {lineNumbers[0]}-{lineNumbers[lineNumbers.length - 1]}
          </div>
          <div>{lines.length} lines</div>
        </div>
      )}
    </div>
  );
}
