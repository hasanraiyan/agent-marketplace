'use client';

import { useState } from 'react';
import { Check, Code, FileCode, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFileSystemActionDetails } from '../utils';
import { toast } from 'sonner';

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
    <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
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
