'use client';

import { useState, useMemo } from 'react';
import { Check, Code, FileCode, FileText, Loader2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getReadFileToolDetails } from '../utils';
import { toast } from 'sonner';

export function ReadFileCard({ tool }) {
  const details = getReadFileToolDetails(tool);
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  if (!details) {
    return (
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-600 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800/60 scrollbar-thin">
        {tool.resultText || 'No result yet.'}
      </pre>
    );
  }

  const { filePath, content, otherArgs } = details;
  
  // Extract filename and folder path
  const fileName = filePath.split('/').pop() || filePath;
  const folderPath = filePath.includes('/')
    ? filePath.substring(0, filePath.lastIndexOf('/') + 1)
    : '';
  const fileExt = fileName.includes('.')
    ? fileName.split('.').pop()?.toLowerCase()
    : '';

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied file content');
  };

  const isCode = ['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'py', 'sh', 'go', 'rs', 'md', 'yaml', 'yml'].includes(fileExt);
  const FileIcon = isCode ? FileCode : FileText;

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

    const offset = parseInt(otherArgs.offset || otherArgs.offsetLine || 0);
    const numbers = rawLines.map((_, i) => offset + i + 1);
    return { lines: rawLines, lineNumbers: numbers, isPrefixed: false };
  }, [content, otherArgs.offset, otherArgs.offsetLine]);

  const done = tool.status === 'completed';

  const displayLines = showRaw ? (content ? content.split('\n') : []) : linesData.lines;
  const displayNumbers = showRaw 
    ? displayLines.map((_, i) => i + 1)
    : linesData.lineNumbers;

  // Format breadcrumbs folder path
  const folders = folderPath.split('/').filter(Boolean);

  return (
    <div className="flex flex-col rounded-[16px] border border-slate-205/70 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-950 transition-all duration-300">
      {/* File Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/40 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30">
            <FileIcon className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Breadcrumb Path */}
              {folders.length > 0 && (
                <div className="flex items-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 truncate select-none">
                  {folders.map((folder, index) => (
                    <span key={index} className="flex items-center">
                      <span className="hover:text-slate-650 transition-colors cursor-pointer">{folder}</span>
                      <span className="mx-1 font-normal opacity-60">/</span>
                    </span>
                  ))}
                </div>
              )}
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-none">
                {fileName}
              </span>
              <span className="shrink-0 rounded-md bg-indigo-50/60 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100/30">
                {fileExt || 'file'}
              </span>
              <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100/30">
                Read
              </span>
            </div>
            {/* Show parameters as small badges in the subheader */}
            <div className="flex gap-2.5 mt-1 select-none flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                offset: <span className="font-mono text-slate-600 dark:text-slate-350 bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-150/50 dark:border-slate-800/80">{otherArgs.offset ?? 0}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                limit: <span className="font-mono text-slate-600 dark:text-slate-350 bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-150/50 dark:border-slate-800/80">{otherArgs.limit ?? 200}</span>
              </span>
              {otherArgs.offset_line !== undefined && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                  offset line: <span className="font-mono text-slate-600 dark:text-slate-350 bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-150/50 dark:border-slate-800/80">{otherArgs.offset_line}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {done && content && (
          <div className="flex items-center gap-1.5 shrink-0 select-none">
            {/* Raw Toggle Button */}
            <Button
              variant="outline"
              size="xs"
              onClick={() => setShowRaw(!showRaw)}
              className="h-7 rounded-lg text-[10px] font-bold uppercase tracking-wider px-2.5 border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900 transition-colors"
            >
              {showRaw ? 'Show Formatted' : '</> Raw'}
            </Button>
            
            {/* Copy Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="size-7 rounded-lg border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900 transition-colors text-slate-450 hover:text-slate-700 dark:hover:text-slate-200"
              title="Copy content"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          </div>
        )}
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
            {showRaw ? 'Showing raw text' : `Showing lines ${displayNumbers[0]}-${displayNumbers[displayNumbers.length - 1]}`}
          </div>
          <div>
            {displayLines.length} lines
          </div>
        </div>
      )}
    </div>
  );
}
