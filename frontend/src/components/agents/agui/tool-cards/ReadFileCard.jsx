'use client';

import { useMemo } from 'react';
import { FileCode, FileText, Loader2 } from 'lucide-react';
import { getReadFileToolDetails } from '../utils';

export function ReadFileCard({ tool }) {
  const details = getReadFileToolDetails(tool);
  // Hooks must run unconditionally — details can be null on one render and
  // present on the next (args still streaming), so the early return comes
  // AFTER the useMemo below.
  const content = details?.content ?? '';
  const otherArgs = details?.otherArgs ?? {};
  const filePath = details?.filePath ?? '';
  const lineOffset = otherArgs.offset ?? otherArgs.offsetLine ?? 0;

  // Process lines and line numbers dynamically
  const linesData = useMemo(() => {
    if (!content) return { lines: [], lineNumbers: [], isPrefixed: false };
    const rawLines = content.split('\n');
    if (rawLines.length > 1 && rawLines[rawLines.length - 1] === '') {
      rawLines.pop();
    }

    // Detect if lines are prefixed with line numbers (e.g. "   1  content")
    let isPrefixed = true;
    const regex = /^\s*(\d+)(?:\s+(.*)|$)/;
    
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (line.trim() === '') continue; // Skip empty lines in validation
      
      const match = line.match(regex);
      if (!match) {
        isPrefixed = false;
        break;
      }
    }

    if (isPrefixed && rawLines.length > 0) {
      const cleaned = [];
      const numbers = [];
      let lastNum = 0;
      
      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const match = line.match(regex);
        if (match) {
          cleaned.push(match[2] || '');
          const num = parseInt(match[1]);
          numbers.push(num);
          lastNum = num;
        } else {
          cleaned.push(line);
          lastNum = lastNum + 1;
          numbers.push(lastNum);
        }
      }
      return { lines: cleaned, lineNumbers: numbers, isPrefixed: true };
    }

    const offset = parseInt(lineOffset) || 0;
    const numbers = rawLines.map((_, i) => offset + i + 1);
    return { lines: rawLines, lineNumbers: numbers, isPrefixed: false };
  }, [content, lineOffset]);

  if (!details) {
    return (
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-600 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800/60 scrollbar-thin">
        {tool.resultText || 'No result yet.'}
      </pre>
    );
  }

  const fileName = filePath.split('/').pop() || filePath;
  const fileExt = fileName.includes('.')
    ? fileName.split('.').pop()?.toLowerCase()
    : '';
  const isCode = ['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'py', 'sh', 'go', 'rs', 'md', 'yaml', 'yml'].includes(fileExt);
  const FileIcon = isCode ? FileCode : FileText;

  const done = tool.status === 'completed';

  const displayLines = linesData.lines;
  const displayNumbers = linesData.lineNumbers;

  return (
    <div className="flex flex-col rounded-[16px] border border-slate-205/70 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-950 transition-all duration-300">
      {/* File Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <FileIcon className="size-4" />
          </div>
          <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
            {filePath}
          </span>
        </div>
      </div>

      {/* Code Editor Preview */}
      {!done ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 dark:text-slate-500">
          <Loader2 className="size-6.5 animate-spin mb-2 opacity-65 text-indigo-500" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-450">Reading file content...</span>
        </div>
      ) : content ? (
        <div className="relative max-h-72 overflow-auto bg-[#0D1117] font-mono text-[11.5px] text-[#C9D1D9] border-t border-slate-100 dark:border-slate-850 scrollbar-thin">
          <div className="flex min-w-full">
            {/* Line Numbers Gutter */}
            <div className="w-10 shrink-0 select-none border-r border-[#30363D] bg-[#161B22]/50 py-3 text-right pr-3 text-[10px] font-bold text-[#8B949E] dark:text-[#57606A]">
              {displayNumbers.map((num, i) => (
                <div key={i} className="h-5 leading-5">
                  {num}
                </div>
              ))}
            </div>
            {/* Code Lines */}
            <div className="flex-1 py-3 pl-3 pr-4 overflow-x-auto select-text">
              {displayLines.map((line, i) => (
                <pre key={i} className="h-5 leading-5 whitespace-pre font-mono text-[#E6EDF2] hover:bg-slate-800/10 dark:hover:bg-slate-800/20 transition-colors">
                  {line || ' '}
                </pre>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center text-slate-450 dark:text-slate-500">
          <FileText className="size-8 mb-2 opacity-45" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Empty file or no content</span>
        </div>
      )}

      {/* Footer Info bar */}
      {done && content && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-2 dark:border-slate-800/80 dark:bg-slate-900/20 text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-tight select-none">
          <div>
            Showing lines {displayNumbers[0]}-{displayNumbers[displayNumbers.length - 1]}
          </div>
          <div>
            {displayLines.length} lines
          </div>
        </div>
      )}
    </div>
  );
}
