'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import {
  Check,
  Code,
  Download,
  FileCode,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import SimpleEditor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';
import 'prismjs/themes/prism.css';
import { getLanguage } from './utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function FilePreviewDialog({
  file,
  open,
  onOpenChange,
}) {
  const [viewMode, setViewMode] = useState('code');
  const [copied, setCopied] = useState(false);

  if (!file) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path.split('/').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('File download started');
  };

  const isPreviewable = file.path.endsWith('.md') || file.path.endsWith('.html');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 min-w-0">
            <FileCode className="size-4 shrink-0 text-slate-500" />
            <DialogTitle className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
              {file.path}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-1">
            {isPreviewable && (
              <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 mr-2">
                <button
                  type="button"
                  onClick={() => setViewMode('code')}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] font-bold transition-colors',
                    viewMode === 'code'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}
                >
                  Code
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] font-bold transition-colors',
                    viewMode === 'preview'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}
                >
                  Preview
                </button>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleCopy}
              title="Copy code"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Code className="size-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleDownload}
              title="Download file"
            >
              <Download className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-white dark:bg-slate-950">
          {viewMode === 'preview' && isPreviewable ? (
            <div className="p-6 h-full">
              {file.path.endsWith('.md') ? (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-pre:my-2 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm dark:prose-code:bg-slate-800 prose-img:rounded-xl prose-a:text-[#1E60FF]">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize]}
                  >
                    {file.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <iframe
                  title="HTML Preview"
                  srcDoc={file.content}
                  className="h-full w-full rounded-xl border-0"
                  sandbox="allow-same-origin"
                />
              )}
            </div>
          ) : (
            <div className="p-4 min-h-full">
              <SimpleEditor
                value={file.content}
                onValueChange={() => {}}
                highlight={(code) => {
                  const lang = getLanguage(file.path);
                  const grammar = Prism.languages[lang] || Prism.languages.markup;
                  return Prism.highlight(code, grammar, lang);
                }}
                padding={10}
                readOnly
                textareaClassName="focus:outline-none"
                className="focus:outline-none"
                style={{
                  fontFamily: 'var(--font-geist-mono)',
                  fontSize: 13,
                  outline: 'none',
                  minHeight: '100%',
                  color: 'inherit',
                  caretColor: 'transparent',
                }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
