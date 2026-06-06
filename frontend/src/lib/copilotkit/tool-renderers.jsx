import { useState } from "react";
import {
  SearchIcon,
  CheckCircle2,
  Circle,
  FileText,
  List,
  Folder,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileCode,
  Globe,
  Users
} from "lucide-react";
import { z } from "zod";
import { defineToolCallRenderer } from "@copilotkit/react-core/v2";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Shared Tool UI Components
 */

const ToolCard = ({
  title,
  status,
  icon: Icon,
  children,
  className,
  isExpandedInitial = false
}) => {
  const [isOpen, setIsOpen] = useState(isExpandedInitial);
  const isProgress = status === "inProgress";
  const isComplete = status === "complete";
  const isError = status === "error";

  return (
    <div className={cn("my-2 overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex size-6 shrink-0 items-center justify-center rounded bg-background shadow-sm">
              {isProgress ? (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              ) : isError ? (
                <AlertCircle className="size-3.5 text-destructive" />
              ) : Icon ? (
                <Icon className="size-3.5 text-muted-foreground" />
              ) : (
                <div className="size-2 rounded-full bg-muted-foreground" />
              )}
            </div>
            <span className="truncate text-sm font-medium leading-none">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isComplete && <Badge variant="outline" className="h-5 border-emerald-500/50 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">Complete</Badge>}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6 p-0">
                {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <div className="border-t p-3 text-sm">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

const JSONView = ({ data, label }) => {
  if (!data) return null;
  const str = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  return (
    <div className="mt-2">
      {label && <div className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">{label}</div>}
      <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[11px] font-mono leading-relaxed">
        {str}
      </pre>
    </div>
  );
};

/**
 * Tool Renderers Generator
 */

export function generateToolRenderers(options = {}) {
  const renderers = options.renderers || [];

  const builtInRenderers = [
    // 1. search_web
    defineToolCallRenderer({
      name: "search_web",
      args: z.object({ query: z.string().optional() }).passthrough(),
      render: ({ status, args, result }) => {
        const query = args?.query || "the web";
        let results = [];
        try {
          if (result) {
             const parsed = typeof result === 'string' ? JSON.parse(result) : result;
             results = Array.isArray(parsed) ? parsed : (parsed.results || []);
          }
        } catch (e) {}

        return (
          <ToolCard
            title={`Searching for "${query}"`}
            status={status}
            icon={Globe}
          >
            {results.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Top Sources</div>
                <ul className="space-y-2">
                  {results.slice(0, 5).map((res, i) => (
                    <li key={i} className="group flex flex-col gap-0.5">
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-medium text-primary hover:underline"
                      >
                        {res.title || res.url}
                      </a>
                      <span className="line-clamp-1 text-[11px] text-muted-foreground">
                        {res.content || res.snippet}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : status === "complete" ? (
              <div className="text-muted-foreground italic">Search completed, no results found.</div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                <span>Fetching results...</span>
              </div>
            )}
          </ToolCard>
        );
      },
    }),

    // 2. write_todos
    defineToolCallRenderer({
      name: "write_todos",
      args: z.object({ todos: z.array(z.object({ content: z.string(), status: z.string() })) }).passthrough(),
      render: ({ status, args }) => {
        const todos = args?.todos || [];
        return (
          <ToolCard title="Updating Plan" status={status} icon={List} isExpandedInitial={true}>
            <div className="space-y-2">
              {todos.map((todo, i) => (
                <div key={i} className="flex items-start gap-2 leading-tight">
                  {todo.status === "done" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  ) : todo.status === "in_progress" ? (
                    <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn(
                    "text-sm",
                    todo.status === "done" && "text-muted-foreground line-through decoration-muted-foreground/50"
                  )}>
                    {todo.content}
                  </span>
                </div>
              ))}
              {todos.length === 0 && <div className="text-muted-foreground italic">No todos listed.</div>}
            </div>
          </ToolCard>
        );
      },
    }),

    // 3. Filesystem: write_file
    defineToolCallRenderer({
      name: "write_file",
      args: z.object({ path: z.string(), content: z.string() }).passthrough(),
      render: ({ status, args }) => (
        <ToolCard title={`Writing to ${args?.path}`} status={status} icon={FileCode}>
          <div className="text-[11px] text-muted-foreground">
            {args?.content ? `Wrote ${args.content.length} characters to file.` : "Empty file."}
          </div>
          <JSONView data={args?.content} label="File Content" />
        </ToolCard>
      ),
    }),

    // 4. Filesystem: edit_file
    defineToolCallRenderer({
      name: "edit_file",
      args: z.object({ path: z.string(), edits: z.array(z.any()) }).passthrough(),
      render: ({ status, args }) => (
        <ToolCard title={`Editing ${args?.path}`} status={status} icon={FileCode}>
          <div className="text-[11px] text-muted-foreground">
            Applying {args?.edits?.length || 0} edits to path.
          </div>
          <JSONView data={args?.edits} label="Edits" />
        </ToolCard>
      ),
    }),

    // 5. Filesystem: read_file
    defineToolCallRenderer({
      name: "read_file",
      args: z.object({ path: z.string() }).passthrough(),
      render: ({ status, args }) => (
        <ToolCard title={`Reading ${args?.path}`} status={status} icon={FileText}>
           <div className="text-[11px] text-muted-foreground">Reading file content...</div>
        </ToolCard>
      ),
    }),

    // 6. Filesystem: ls / glob / grep
    defineToolCallRenderer({
      name: "ls",
      args: z.object({ path: z.string().optional() }).passthrough(),
      render: ({ status, args, result }) => {
         let files = [];
         try { if(result) files = typeof result === 'string' ? JSON.parse(result) : result; } catch(e){}
         return (
          <ToolCard title={`Listing ${args?.path || "root"}`} status={status} icon={Folder}>
            {Array.isArray(files) ? (
              <div className="text-[11px] text-muted-foreground">Found {files.length} items.</div>
            ) : null}
          </ToolCard>
         )
      }
    }),

    // 7. task (subagent)
    defineToolCallRenderer({
      name: "task",
      args: z.object({ task: z.string(), subagent: z.string().optional() }).passthrough(),
      render: ({ status, args }) => (
        <ToolCard
          title={`Delegating to ${args?.subagent || "subagent"}`}
          status={status}
          icon={Users}
        >
          <div className="font-medium text-foreground mb-1">{args?.task}</div>
          <div className="text-[11px] text-muted-foreground">The subagent is processing this task in a separate context.</div>
        </ToolCard>
      ),
    }),
  ];

  renderers.push(...builtInRenderers);

  // 8. Fallback (at the end)
  const handledToolNames = renderers.map(r => r.name);
  if (options.additionalToolNames) {
    handledToolNames.push(...options.additionalToolNames);
  }

  renderers.push(
    defineToolCallRenderer({
      name: /^.*$/, // Match anything
      render: ({ name, status, args, result }) => {
        // Skip some tools we know we handle or that shouldn't render
        if (handledToolNames.includes(name)) return null;

        return (
          <ToolCard title={`Tool: ${name}`} status={status}>
            <JSONView data={args} label="Arguments" />
            {result && <JSONView data={result} label="Result" />}
          </ToolCard>
        );
      }
    })
  );

  return renderers;
}
