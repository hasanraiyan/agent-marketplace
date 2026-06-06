"use client";

/**
 * Files panel — the marketplace's equivalent of Claude Artifacts / ChatGPT
 * Canvas. The agent works against a virtual filesystem (deepagents StateBackend)
 * that the user could never see; the backend now mirrors that state to the
 * client via AG-UI STATE_SNAPSHOT events, and this panel surfaces it with
 * preview + download.
 *
 * State shape (from aguiTranslator.buildFilesTodosSnapshot):
 *   agent.state.files = { [path]: { content, size, created_at, modified_at } }
 */

import { useMemo, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { FileText, Download, X, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function baseName(path) {
  const parts = String(path).split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

function formatBytes(n) {
  if (typeof n !== "number" || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadFile(path, content) {
  const blob = new Blob([content ?? ""], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = baseName(path);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Reads the live virtual filesystem from agent state and renders a list with a
 * preview/download flyout. Renders nothing until the agent has produced files,
 * so it stays out of the way on a fresh chat.
 *
 * Pass the same `agentId`/`threadId` the chat surface uses so the panel reads
 * the agent instance that actually ran. Both default to CopilotKit's defaults
 * (agent "default", the provider thread) — which matches a `<CopilotChat>`
 * rendered without those props.
 *
 * @param {string} [agentId]   the CopilotKit agent id (matches the chat surface).
 * @param {string} [threadId]  the CopilotKit thread id (matches the chat surface).
 */
export function FilesPanel({ agentId, threadId }) {
  const { agent } = useAgent({ agentId, threadId });
  const [selected, setSelected] = useState(null);

  const files = useMemo(() => {
    const raw = agent?.state?.files;
    if (!raw || typeof raw !== "object") return [];
    return Object.entries(raw)
      .map(([path, data]) => ({
        path,
        content: typeof data?.content === "string" ? data.content : "",
        size: typeof data?.size === "number" ? data.size : 0,
        modified_at: data?.modified_at ?? null,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [agent?.state?.files]);

  if (files.length === 0) return null;

  const active = files.find((f) => f.path === selected) || null;

  return (
    <div className="hidden h-full w-72 shrink-0 flex-col border-l bg-muted/10 lg:flex xl:w-80">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <FolderOpen className="size-4 text-muted-foreground" />
        <span className="text-sm font-bold">Files</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {files.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {active ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b bg-background px-3 py-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{active.path}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                title="Download"
                onClick={() => downloadFile(active.path, active.content)}
              >
                <Download className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                title="Close preview"
                onClick={() => setSelected(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed">
              {active.content || "(empty file)"}
            </pre>
          </div>
        ) : (
          <ul className="divide-y">
            {files.map((f) => (
              <li key={f.path}>
                <button
                  type="button"
                  onClick={() => setSelected(f.path)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
                  )}
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{baseName(f.path)}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {f.path}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                  <Download
                    role="button"
                    aria-label="Download"
                    className="size-3.5 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadFile(f.path, f.content);
                    }}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
