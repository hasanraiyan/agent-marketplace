'use client';

import { useState, useMemo } from 'react';
import { Check, Code, FileCode, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getReadFileToolDetails } from '../utils';
import { toast } from 'sonner';

export function ReadFileCard({ tool }) {
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

  const lines = useMemo(() => {
    if (!content) return [];
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
      return rawLines.map((line) => {
        const match = line.match(regex);
        return match ? (match[2] || '') : line;
      });
    }

    return rawLines;
  }, [content]);

  const done = tool.status === 'completed';

  return (
    <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
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
