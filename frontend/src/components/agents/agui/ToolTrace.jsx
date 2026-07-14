'use client';

import { memo, useState } from 'react';
import {
  AlertCircle,
  BotIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit,
  FileText,
  Globe,
  ListTodo,
  Loader2,
  Search,
  Cpu,
  Wrench,
  BookText,
} from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
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
  isFileWriteTool,
  isFileEditTool,
  toolTitle,
  searchResults,
  getDomain,
} from './utils';
import { TodoChecklist } from './TodoChecklist';
import { toast } from 'sonner';
import { RequestResponsePanel } from './tool-cards/RequestResponsePanel';
import { GrepResultsView, parseGrepResults } from './tool-cards/GrepResultsView';
import { LsDirectoryCard } from './tool-cards/LsDirectoryCard';
import { ReadFileCard } from './tool-cards/ReadFileCard';
import { FileDiffCard } from './tool-cards/DiffView';
import { SubagentActivityDialog } from './SubagentActivityDialog';

export { FileSystemActionCard, ActionArguments } from './tool-cards/FileSystemActionCard';

export function subToolIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('search')) return Globe;
  if (n.includes('grep')) return Search;
  if (n.includes('todo')) return ListTodo;
  if (n.includes('file') || n === 'glob' || n === 'ls') return FileText;
  return Wrench;
}

// The subagent's scoped mini-transcript: streamed text interleaved with its
// own tool calls, rendered inside the owning task card. `compact` is the live
// tail shown while the subagent is still running.
export function SubAgentTimeline({ items, compact = false }) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {items.map((item, index) => {
        if (item.type === 'text') {
          const text = compact
            ? item.text.trimEnd().split('\n').slice(-2).join('\n')
            : item.text;
          if (!text) return null;
          // The live tail stays plain text (it shows mid-stream fragments);
          // the full timeline renders the subagent's prose as Markdown.
          if (compact) {
            return (
              <p
                key={index}
                className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-500 dark:text-slate-400"
              >
                {text}
              </p>
            );
          }
          return (
            <div
              key={index}
              className="prose prose-sm max-w-none break-words text-[13px] leading-6 text-slate-600 dark:prose-invert dark:text-slate-300 prose-p:my-1 prose-pre:my-2 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {text}
              </ReactMarkdown>
            </div>
          );
        }
        const running = item.status === 'running';
        // Full view: the subagent's tool calls are first-class, expandable
        // trace cards — its plan renders as the real checklist, its searches
        // as result cards — exactly like the main transcript.
        if (!compact) {
          return (
            <ToolTrace
              key={index}
              tool={{
                id: `sub-${index}`,
                name: item.name,
                argumentsText: item.argsText,
                resultText: item.resultText,
                status: running ? 'running' : 'completed',
              }}
            />
          );
        }
        const Icon = subToolIcon(item.name);
        return (
          <div key={index} className="flex items-center gap-2 text-xs">
            {running ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-orange-500" />
            ) : (
              <Check className="size-3.5 shrink-0 text-emerald-500" />
            )}
            <Icon className="size-3.5 shrink-0 text-slate-400" />
            <span className="min-w-0 truncate font-medium text-slate-600 dark:text-slate-300">
              {toolTitle({
                name: item.name,
                argumentsText: item.argsText,
                status: running ? 'running' : 'completed',
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Memoized: streaming updates replace only the affected tool object, so other
// tool cards keep their identity and can skip re-rendering.
export const ToolTrace = memo(function ToolTrace({ tool }) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const done = tool.status === 'completed';
  const results = searchResults(tool);
  const parsedResult = tryParseJson(tool.resultText);
  const isError = parsedResult?.status === 'error';
  const nameLower = (tool.name || '').toLowerCase();
  const isWebSearch = tool.name === 'search_web' || nameLower.includes('google') || nameLower.startsWith('tavily');
  const isKbSearch = nameLower.startsWith('search_') && !isWebSearch;
  const isKbListSources = nameLower === 'list_knowledge_base_sources' || nameLower.startsWith('list_sources_');

  const isGrep = nameLower.includes('grep');
  const isTodo = isTodoTool(tool.name);
  const isSkill = isSkillTool(tool.name);
  const isAgent = isAgentTool(tool.name);
  const isSubagent = nameLower === 'task';
  const todos = isTodo ? parseTodos(tool.argumentsText, tool.resultText) : null;
  const todosDone = todos
    ? todos.filter((todo) => todo.status === 'completed').length
    : 0;
  const subEvents = Array.isArray(tool.subEvents) ? tool.subEvents : [];
  const subToolUses = subEvents.filter((item) => item.type === 'tool').length;
  const isExpandable = Boolean(
    tool.resultText || tool.argumentsText || subEvents.length,
  );
  const Icon = isError
    ? AlertCircle
    : isWebSearch
      ? Globe
      : isKbSearch || isKbListSources
        ? BookText
        : isGrep
          ? Search
          : isTodo
            ? ListTodo
            : isSkill
              ? Cpu
              : isAgent || isSubagent
                ? BotIcon
                : tool.name?.includes('file')
                  ? FileText
                  : Wrench;

  // Subagent runs don't clutter the main feed with an inline accordion —
  // tapping the card opens the SubagentActivityDialog instead.
  const handleToggle = () => {
    if (isSubagent) {
      setDialogOpen(true);
      return;
    }
    if (isExpandable) setOpen((value) => !value);
  };

  return (
    <div className="max-w-[92%]">
      <button
        type="button"
        onClick={handleToggle}
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
              {isTodo && todos ? `Plan (${todosDone}/${todos.length})` : toolTitle(tool)}
              {isSubagent && subToolUses > 0 ? (
                <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">
                  · {subToolUses} tool {subToolUses === 1 ? 'use' : 'uses'}
                </span>
              ) : null}
            </span>
            {isExpandable ? (
              open ? (
                <ChevronUp className="size-4 text-slate-400" />
              ) : (
                <ChevronDown className="size-4 text-slate-400" />
              )
            ) : null}
            {/* The Plan title already carries its status (x/y) — no badge. */}
            {isError || !(isTodo && todos) ? (
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
                  : isWebSearch && done && results.length
                    ? `${results.length} results`
                    : isGrep && done
                      ? `${parseGrepResults(tool.resultText).length} matches`
                      : done
                        ? 'Result'
                        : 'Running'}
              </span>
            ) : null}
          </span>
        </span>
      </button>

      {isError ? (
        <div className="ml-8 mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {parsedResult.message || 'The tool call failed.'}
        </div>
      ) : null}

      {!done && subEvents.length > 0 ? (
        <div className="ml-8 mt-1 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <BotIcon className="size-3 animate-pulse text-orange-500" />
            Subagent working
          </div>
          <SubAgentTimeline items={subEvents.slice(-4)} compact />
        </div>
      ) : null}
      {open ? (
        isLsTool(tool.name) ? (
          <div className="ml-8 mt-1 text-sm">
            <LsDirectoryCard tool={tool} />
          </div>
        ) : isReadFileTool(tool.name) ? (
          <div className="ml-8 mt-1 text-sm">
            <ReadFileCard tool={tool} />
          </div>
        ) : (isFileWriteTool(tool.name) || isFileEditTool(tool.name)) && !isError ? (
          <div className="ml-8 mt-1 text-sm">
            <FileDiffCard tool={tool} />
          </div>
        ) : (
          <div className="ml-8 mt-1 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-900/70">
            {/* Tool Inputs */}
            {tool.argumentsText && !isTodo && !isGrep && (
              <RequestResponsePanel label="Request" text={tool.argumentsText} />
            )}

            {/* The subagent's scoped timeline: its text + its own tool calls */}
            {subEvents.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                  Subagent Activity
                </div>
                <div className="max-h-64 overflow-auto rounded-xl border border-slate-150 bg-slate-100/50 p-2.5 dark:border-slate-800/60 dark:bg-slate-900/50 scrollbar-thin">
                  <SubAgentTimeline items={subEvents} />
                </div>
              </div>
            )}

            {/* Tool Outputs / Status */}
            {isSkill && done && !isError ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="size-4" />
                  Skill Successfully {tryParseJson(tool.argumentsText)?.action === 'delete' ? 'Deleted' : 'Saved'}
                </div>
                {tryParseJson(tool.argumentsText)?.action !== 'delete' && (
                  <Link href={`/dashboard/connectors/skills/${parsedResult?.data?._id || parsedResult?.data?.id}`}>
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
            ) : isWebSearch ? (
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
            ) : tool.resultText ? (
              <RequestResponsePanel
                label="Response"
                text={tool.resultText}
                structuredData={tool.structuredResult}
              />
            ) : (
              <div className="text-xs italic text-slate-400 dark:text-slate-500">
                No result yet.
              </div>
            )}
          </div>
        )
      ) : null}

      {isSubagent ? (
        <SubagentActivityDialog tool={tool} open={dialogOpen} onOpenChange={setDialogOpen} />
      ) : null}
    </div>
  );
});
