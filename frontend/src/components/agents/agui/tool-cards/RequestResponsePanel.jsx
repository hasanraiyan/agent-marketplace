'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { tryParseJson } from '../utils';
import { JsonTreeView } from './JsonTreeView';
import { cn } from '@/lib/utils';

/**
 * A labeled "Request" / "Response" card: a collapsible JSON tree, with a
 * copy-to-clipboard button. Renders the full tree with no height cap - nodes
 * collapse individually instead of the whole panel scrolling.
 *
 * When the caller already has the tool's real structured data (e.g.
 * `structuredContent` from an MCP tool - see aguiTranslator's
 * extractStructuredContent), pass it as `structuredData` and it's rendered
 * directly instead of re-parsing the flattened text, which can be a lossy
 * stringified copy or, for non-text results, missing entirely.
 */
export function RequestResponsePanel({ label, text, structuredData, className }) {
  const [copied, setCopied] = useState(false);

  const hasStructured = structuredData !== undefined && structuredData !== null;
  const parsed = hasStructured ? structuredData : tryParseJson(text);
  const isJson = parsed !== null && typeof parsed === 'object';

  if (!hasStructured && !text) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(isJson ? JSON.stringify(parsed, null, 2) : text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className={cn('rounded-xl border border-slate-150 bg-white dark:border-slate-800/60 dark:bg-slate-950 overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-slate-50/60 dark:border-slate-800/60 dark:bg-slate-900/40">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-150 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="p-2.5 scrollbar-thin">
        {isJson ? (
          <JsonTreeView data={parsed} />
        ) : (
          <div className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            {text}
          </div>
        )}
      </div>
    </div>
  );
}
