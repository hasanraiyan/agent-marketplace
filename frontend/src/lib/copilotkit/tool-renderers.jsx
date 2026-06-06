"use client";

/**
 * Shared CopilotKit tool-call renderers for every chat surface (run page,
 * builder "Create" pane, builder "Preview" pane).
 *
 * Previously each surface inlined its own `search_web` renderer and nothing
 * else, so every deepagents built-in (write_todos, the virtual filesystem,
 * subagent `task`) fell through to CopilotKit's raw generic card (dumped JSON)
 * — and `search_web` itself vanished the instant it completed. This module is
 * the single source of truth: import `baseToolRenderers` and pass it to
 * `<CopilotKit renderToolCalls={...} />`.
 *
 * Render contract (CopilotKit v2): each `render` receives
 *   { name, toolCallId, args, status, result }
 * where `status` is one of "inProgress" | "executing" | "complete", `args` is
 * the (possibly partial, streaming) parsed tool arguments, and `result` is the
 * tool's string output — present only once `status === "complete"`.
 */

import { useState } from "react";
import {
  Search,
  Globe,
  Check,
  Loader2,
  ChevronRight,
  FileText,
  FilePlus,
  FilePenLine,
  FolderTree,
  ListTodo,
  Users,
  Wrench,
  ExternalLink,
  CircleDashed,
  CircleDot,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { z } from "zod";
import { defineToolCallRenderer } from "@copilotkit/react-core/v2";
import { cn } from "@/lib/utils";

// ── status helpers ──────────────────────────────────────────────────────────
const isComplete = (status) => status === "complete";
const isActive = (status) => status === "executing" || status === "inProgress";

function StatusIcon({ status, className }) {
  if (isComplete(status)) {
    return <Check className={cn("size-3.5 shrink-0 text-emerald-600", className)} />;
  }
  return (
    <Loader2 className={cn("size-3.5 shrink-0 animate-spin text-muted-foreground", className)} />
  );
}

// ── tolerant parsing helpers ────────────────────────────────────────────────
function safeParse(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function countLines(text) {
  if (typeof text !== "string" || text.length === 0) return 0;
  return text.split("\n").length;
}

function fileName(path) {
  if (typeof path !== "string" || !path) return "";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

// ── shared layout primitives ────────────────────────────────────────────────

/**
 * Single-line, non-expandable tool pill — for low-signal calls (read_file, ls,
 * glob, grep) where the action is fully described by one sentence.
 */
function ToolLine({ icon: Icon, status, children }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground">
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <StatusIcon status={status} />
    </div>
  );
}

/**
 * Collapsible tool card with a header (icon + title + optional trailing badge +
 * status) and an expandable body. `defaultOpen` controls the initial state;
 * pass `dense` to drop the body padding (used when the body is itself a list).
 */
function ToolCard({ icon: Icon, title, badge, status, defaultOpen = false, dense = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasBody = Boolean(children);

  return (
    <div className="overflow-hidden rounded-md border bg-muted/20 text-sm">
      <button
        type="button"
        onClick={() => hasBody && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left",
          hasBody && "hover:bg-muted/40"
        )}
        aria-expanded={hasBody ? open : undefined}
        disabled={!hasBody}
      >
        {hasBody && (
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
        )}
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium text-foreground">{title}</span>
        {badge ? (
          <span className="min-w-0 truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {badge}
          </span>
        ) : null}
        <span className="ml-auto flex items-center pl-2">
          <StatusIcon status={status} />
        </span>
      </button>
      {hasBody && open ? (
        <div className={cn("border-t bg-background/50", dense ? "" : "p-3")}>{children}</div>
      ) : null}
    </div>
  );
}

function CodeBlock({ children, className }) {
  return (
    <pre
      className={cn(
        "max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono text-xs leading-relaxed text-foreground",
        className
      )}
    >
      {children}
    </pre>
  );
}

// ── search_web ──────────────────────────────────────────────────────────────
// Tavily returns `{ query, answer?, results: [{ title, url, content, score }] }`
// (as a JSON string). Render the query + a collapsible source list, and keep it
// on screen after completion instead of returning null.
function SearchWebRender({ status, args, result }) {
  const query = typeof args?.query === "string" ? args.query : "";

  if (!isComplete(status)) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <Search className="size-3.5 shrink-0 animate-pulse" />
        <span className="truncate">
          Searching the web{query ? ` for "${query}"` : ""}…
        </span>
      </div>
    );
  }

  const parsed = safeParse(result);
  const results = Array.isArray(parsed?.results)
    ? parsed.results
    : Array.isArray(parsed)
      ? parsed
      : [];
  const title = query ? `Searched for "${query}"` : "Web search";

  return (
    <ToolCard
      icon={Globe}
      title={title}
      badge={results.length ? `${results.length} source${results.length === 1 ? "" : "s"}` : undefined}
      status={status}
      defaultOpen={false}
      dense
    >
      {parsed?.answer ? (
        <p className="border-b px-3 py-2 text-sm text-foreground">{parsed.answer}</p>
      ) : null}
      {results.length ? (
        <ul className="divide-y">
          {results.map((r, i) => (
            <li key={r.url || i} className="px-3 py-2">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <ExternalLink className="mt-0.5 size-3 shrink-0" />
                <span className="min-w-0 break-words">{r.title || r.url}</span>
              </a>
              {r.content ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.content}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-2 text-sm text-muted-foreground">No sources returned.</p>
      )}
    </ToolCard>
  );
}

// ── write_todos ─────────────────────────────────────────────────────────────
// args: { todos: [{ content, status: "pending" | "in_progress" | "completed" }] }
function TodoStatusIcon({ status }) {
  if (status === "completed") return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />;
  if (status === "in_progress") return <CircleDot className="mt-0.5 size-4 shrink-0 text-blue-600" />;
  if (status === "pending") return <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
  return <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
}

function WriteTodosRender({ status, args }) {
  const todos = Array.isArray(args?.todos) ? args.todos : [];
  const done = todos.filter((t) => t?.status === "completed").length;

  return (
    <ToolCard
      icon={ListTodo}
      title="Plan"
      badge={todos.length ? `${done}/${todos.length}` : undefined}
      status={status}
      defaultOpen
      dense
    >
      {todos.length ? (
        <ul className="space-y-1 p-3">
          {todos.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <TodoStatusIcon status={t?.status} />
              <span
                className={cn(
                  "min-w-0 break-words",
                  t?.status === "completed" && "text-muted-foreground line-through",
                  t?.status === "in_progress" && "font-medium text-foreground"
                )}
              >
                {t?.content || ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-3 text-sm text-muted-foreground">Updating plan…</p>
      )}
    </ToolCard>
  );
}

// ── write_file / edit_file ──────────────────────────────────────────────────
function WriteFileRender({ status, args }) {
  const path = typeof args?.file_path === "string" ? args.file_path : "";
  const content = typeof args?.content === "string" ? args.content : "";
  const added = countLines(content);

  return (
    <ToolCard icon={FilePlus} title="Wrote file" badge={fileName(path) || undefined} status={status}>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{path}</span>
        {added ? <span className="text-emerald-600">+{added}</span> : null}
      </div>
      {content ? <CodeBlock>{content}</CodeBlock> : null}
    </ToolCard>
  );
}

function EditFileRender({ status, args, result }) {
  const path = typeof args?.file_path === "string" ? args.file_path : "";
  const oldStr = typeof args?.old_string === "string" ? args.old_string : "";
  const newStr = typeof args?.new_string === "string" ? args.new_string : "";
  const removed = countLines(oldStr);
  const added = countLines(newStr);

  return (
    <ToolCard icon={FilePenLine} title="Edited file" badge={fileName(path) || undefined} status={status}>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{path}</span>
        {removed ? <span className="text-red-600">-{removed}</span> : null}
        {added ? <span className="text-emerald-600">+{added}</span> : null}
      </div>
      {oldStr ? (
        <CodeBlock className="border border-red-200 bg-red-50/50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
          {oldStr}
        </CodeBlock>
      ) : null}
      {newStr ? (
        <CodeBlock className="mt-1 border border-emerald-200 bg-emerald-50/50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
          {newStr}
        </CodeBlock>
      ) : null}
      {isComplete(status) && typeof result === "string" && result ? (
        <p className="mt-2 text-xs text-muted-foreground">{result}</p>
      ) : null}
    </ToolCard>
  );
}

// ── read_file / ls / glob / grep (compact lines) ────────────────────────────
function ReadFileRender({ status, args }) {
  const path = typeof args?.file_path === "string" ? args.file_path : "";
  return (
    <ToolLine icon={FileText} status={status}>
      Read <span className="font-mono">{path || "file"}</span>
    </ToolLine>
  );
}

function countResultLines(result) {
  if (typeof result !== "string" || !result.trim()) return null;
  return result.split("\n").filter((l) => l.trim().length > 0).length;
}

function LsRender({ status, result }) {
  const n = isComplete(status) ? countResultLines(result) : null;
  return (
    <ToolLine icon={FolderTree} status={status}>
      {n != null ? `Listed ${n} item${n === 1 ? "" : "s"}` : "Listing files…"}
    </ToolLine>
  );
}

function GlobRender({ status, args, result }) {
  const pattern = typeof args?.pattern === "string" ? args.pattern : "";
  const n = isComplete(status) ? countResultLines(result) : null;
  return (
    <ToolLine icon={FolderTree} status={status}>
      {pattern ? (
        <>
          Found files matching <span className="font-mono">{pattern}</span>
          {n != null ? ` — ${n} match${n === 1 ? "" : "es"}` : ""}
        </>
      ) : (
        "Finding files…"
      )}
    </ToolLine>
  );
}

function GrepRender({ status, args, result }) {
  const pattern = typeof args?.pattern === "string" ? args.pattern : "";
  const n = isComplete(status) ? countResultLines(result) : null;
  return (
    <ToolLine icon={Search} status={status}>
      {pattern ? (
        <>
          Searched <span className="font-mono">{pattern}</span>
          {n != null ? ` — ${n} match${n === 1 ? "" : "es"}` : ""}
        </>
      ) : (
        "Searching files…"
      )}
    </ToolLine>
  );
}

// ── task (subagent delegation) ──────────────────────────────────────────────
function TaskRender({ status, args, result }) {
  const subagent = typeof args?.subagent_type === "string" ? args.subagent_type : "subagent";
  const description = typeof args?.description === "string" ? args.description : "";

  return (
    <ToolCard
      icon={Users}
      title={`Delegated to ${subagent}`}
      status={status}
      defaultOpen={isActive(status)}
    >
      {description ? <p className="mb-2 text-sm text-foreground">{description}</p> : null}
      {isComplete(status) && typeof result === "string" && result ? (
        <CodeBlock>{result}</CodeBlock>
      ) : (
        <p className="text-sm text-muted-foreground">Working…</p>
      )}
    </ToolCard>
  );
}

// ── generic fallback ("*") ──────────────────────────────────────────────────
// Any tool without a dedicated renderer above. Replaces CopilotKit's raw-JSON
// default with a consistent, collapsible card so nothing ever dumps JSON or
// disappears on completion.
function GenericToolRender({ name, status, args, result }) {
  const hasArgs = args && typeof args === "object" && Object.keys(args).length > 0;
  const parsedResult = safeParse(result);
  const prettyResult =
    parsedResult != null
      ? JSON.stringify(parsedResult, null, 2)
      : typeof result === "string"
        ? result
        : "";

  return (
    <ToolCard icon={Wrench} title={name || "Tool"} status={status}>
      {hasArgs ? (
        <div className="mb-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Arguments</p>
          <CodeBlock>{JSON.stringify(args, null, 2)}</CodeBlock>
        </div>
      ) : null}
      {isComplete(status) && prettyResult ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Result</p>
          <CodeBlock>{prettyResult}</CodeBlock>
        </div>
      ) : null}
      {!hasArgs && !(isComplete(status) && prettyResult) ? (
        <p className="text-sm text-muted-foreground">
          {isComplete(status) ? "Completed." : "Running…"}
        </p>
      ) : null}
    </ToolCard>
  );
}

// ── registry ────────────────────────────────────────────────────────────────
const anyArgs = z.any();

/**
 * The complete set of shared tool-call renderers. Pass directly to
 * `<CopilotKit renderToolCalls={baseToolRenderers} />`. Surfaces that need an
 * extra renderer (e.g. the architect's headless `upsert_agent` sync) should
 * prepend their own and spread these: `[upsertRenderer, ...baseToolRenderers]`.
 * Exact tool-name matches always win over the `"*"` fallback.
 */
export const baseToolRenderers = [
  defineToolCallRenderer({
    name: "search_web",
    args: z.object({ query: z.string().optional() }).passthrough(),
    render: SearchWebRender,
  }),
  defineToolCallRenderer({ name: "write_todos", args: anyArgs, render: WriteTodosRender }),
  defineToolCallRenderer({ name: "write_file", args: anyArgs, render: WriteFileRender }),
  defineToolCallRenderer({ name: "edit_file", args: anyArgs, render: EditFileRender }),
  defineToolCallRenderer({ name: "read_file", args: anyArgs, render: ReadFileRender }),
  defineToolCallRenderer({ name: "ls", args: anyArgs, render: LsRender }),
  defineToolCallRenderer({ name: "glob", args: anyArgs, render: GlobRender }),
  defineToolCallRenderer({ name: "grep", args: anyArgs, render: GrepRender }),
  defineToolCallRenderer({ name: "task", args: anyArgs, render: TaskRender }),
  defineToolCallRenderer({ name: "*", args: anyArgs, render: GenericToolRender }),
];
