'use client';

import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import {
  Check,
  ChevronLeft,
  Code,
  FileCode,
  ListTodo,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
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
import { getFileIcon, getLanguage } from './utils';
import { TodoChecklist } from './TodoChecklist';

export function AguiFilesPanel({
  state,
  open,
  onOpenChange,
  tab: tabProp,
  onTabChange,
}) {
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);
  const [internalTab, setInternalTab] = useState('files');
  const [viewMode, setViewMode] = useState('code');
  const { theme } = useTheme();
  const files = Object.entries(state?.files || {})
    .filter(([path, data]) => {
      if (!path || typeof path !== 'string') return false;
      if (
        path.endsWith('/') ||
        data?.is_dir === true ||
        data?.isDir === true ||
        data?.isDirectory === true ||
        data?.type === 'directory'
      ) {
        return false;
      }
      // Filter out hidden versions directory
      if (path.startsWith('/.versions/') || path.startsWith('.versions/')) {
        return false;
      }
      return true;
    })
    .map(([path, data]) => ({
      path,
      content: data?.content || '',
      size: data?.size || 0,
    }));

  const [selectedVersion, setSelectedVersion] = useState(null);

  useEffect(() => {
    setSelectedVersion(null);
  }, [selected]);

  const activeVersions = useMemo(() => {
    if (!active) return [];
    const normalizedPath = active.path.startsWith('/') ? active.path : '/' + active.path;
    const prefix = `/.versions${normalizedPath}.v`;

    return Object.entries(state?.files || {})
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, data]) => {
        const verNum = parseInt(path.slice(prefix.length));
        return {
          version: verNum,
          path,
          content: data?.content || '',
          modifiedAt: data?.modified_at || data?.modifiedAt || '',
        };
      })
      .sort((a, b) => b.version - a.version);
  }, [active, state?.files]);

  const displayContent = selectedVersion ? selectedVersion.content : (active?.content || '');
  const todos = Array.isArray(state?.todos) ? state.todos : [];
  const todosDone = todos.filter((todo) => todo?.status === 'completed').length;
  // Tab is controlled by the parent when provided (so a header button can
  // open the panel directly on Plan), otherwise managed locally.
  const tab = tabProp ?? internalTab;
  const setTab = onTabChange ?? setInternalTab;
  const active = files.find((file) => file.path === selected);

  const handleCopy = () => {
    if (!active) return;
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  if (!files.length && !todos.length) return null;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-slate-200 bg-white transition-all duration-300 lg:static lg:z-0 dark:border-slate-800 dark:bg-slate-950',
        open
          ? 'translate-x-0 shadow-2xl lg:shadow-none lg:w-[450px] xl:w-[600px]'
          : 'translate-x-full lg:w-0 lg:translate-x-0 lg:border-none lg:opacity-0',
        'overflow-hidden',
      )}
    >
      <div className="flex h-14 shrink-0 flex-col items-start justify-center border-b border-slate-200 px-4 dark:border-slate-800">
        <div className="flex w-full items-center gap-2">
          {tab === 'files' && active ? (
            <>
              <button
                onClick={() => setSelected(null)}
                className="group -ml-1.5 flex items-center gap-1 rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Back to Explorer"
              >
                <ChevronLeft className="size-4 text-slate-500" />
                <FileCode className="size-4 shrink-0 text-slate-500" />
                <span className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {active.path.split('/').pop()}
                </span>
              </button>
              <div className="ml-auto flex items-center gap-1">
                {/* Preview toggle for .md and .html files */}
                {(active.path.endsWith('.md') || active.path.endsWith('.html')) && (
                  <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900 mr-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('code')}
                      className={cn(
                        'rounded-md px-2 py-1 text-[11px] font-bold transition-colors',
                        viewMode === 'code'
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
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
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      )}
                    >
                      Preview
                    </button>
                  </div>
                )}
                {activeVersions.length > 0 && (
                  <select
                    value={selectedVersion ? selectedVersion.version : 'current'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'current') {
                        setSelectedVersion(null);
                      } else {
                        const ver = activeVersions.find((v) => v.version === parseInt(val));
                        setSelectedVersion(ver);
                      }
                    }}
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 focus:outline-none focus:ring-0 mr-1 cursor-pointer"
                  >
                    <option value="current">Current</option>
                    {activeVersions.map((v) => (
                      <option key={v.version} value={v.version}>
                        v{v.version}
                      </option>
                    ))}
                  </select>
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
                  onClick={() => onOpenChange?.(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setTab('plan')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition-colors',
                    tab === 'plan'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                  )}
                >
                  <ListTodo className="size-3.5" />
                  Plan
                </button>
                <button
                  type="button"
                  onClick={() => setTab('files')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition-colors',
                    tab === 'files'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                  )}
                >
                  <FileCode className="size-3.5" />
                  Files
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-8"
                onClick={() => onOpenChange?.(false)}
              >
                <X className="size-4" />
              </Button>
            </>
          )}
        </div>
        {!(tab === 'files' && active) && (
          <div className="text-[11px] font-bold text-slate-400">
            {tab === 'plan'
              ? todos.length
                ? `${todosDone} of ${todos.length} done`
                : 'No plan yet'
              : `${files.length} Files`}
          </div>
        )}
      </div>

      {tab === 'plan' ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {todos.length ? (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Progress</span>
                  <span className="tabular-nums">
                    {todosDone}/{todos.length}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-[#1E60FF] transition-all duration-500"
                    style={{
                      width: `${(todosDone / todos.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <TodoChecklist todos={todos} />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <ListTodo className="size-8 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                No plan yet
              </p>
              <p className="max-w-[220px] text-xs text-slate-400 dark:text-slate-500">
                The agent will break complex tasks into steps and track them
                here.
              </p>
            </div>
          )}
        </div>
      ) : active ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto bg-white p-4 dark:bg-slate-950">
            {viewMode === 'preview' && (active.path.endsWith('.md') || active.path.endsWith('.html')) ? (
              /* Rendered Preview */
              <div className="h-full w-full overflow-auto">
                {active.path.endsWith('.md') ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-pre:my-2 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm dark:prose-code:bg-slate-800 prose-img:rounded-xl prose-a:text-[#1E60FF]">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeSanitize]}
                    >
                      {displayContent}
                    </ReactMarkdown>
                  </div>
                ) : (
                  /* HTML preview via iframe */
                  <iframe
                    title="HTML Preview"
                    srcDoc={displayContent}
                    className="h-full w-full rounded-xl border-0"
                    sandbox="allow-same-origin"
                  />
                )}
              </div>
            ) : (
              <SimpleEditor
                value={displayContent}
                onValueChange={() => {}}
                highlight={(code) => {
                  const lang = getLanguage(active.path);
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
                  color: '#1a1a1a',
                  caretColor: 'transparent',
                }}
              />
            )}
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="truncate font-mono text-[10px] text-slate-400">
              {active.path}
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="p-2 space-y-1">
            {files.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelected(file.path)}
                className="group flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="mt-0.5">{getFileIcon(file.path)}</div>
                <div className="min-w-0 flex-1">
                  <div className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                    {file.path.split('/').pop()}
                  </div>
                  <div className="block truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                    {file.path}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
