"use client";

import { useState } from "react";
import {
  FileText,
  List,
  ChevronRight,
  ChevronDown,
  Download,
  FileCode,
  CheckCircle2,
  Circle,
  Loader2,
  FolderOpen
} from "lucide-react";
import { useAgent } from "@copilotkit/react-core/v2";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function ArtifactPanel({ agentId, threadId }) {
  const { agent } = useAgent({ agentId, threadId });
  const [isFilesOpen, setIsFilesOpen] = useState(true);
  const [isTodosOpen, setIsTodosOpen] = useState(true);

  // Access agent state directly. AG-UI agents have a .state property.
  const state = agent?.state || {};
  const files = state.files || {};
  const todos = state.todos || [];

  const filePaths = Object.keys(files).sort();

  const downloadFile = (path, content) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = path.split("/").pop() || "file.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (filePaths.length === 0 && todos.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <FolderOpen className="mb-4 size-12 opacity-20" />
        <p className="text-sm font-medium">No artifacts yet.</p>
        <p className="text-xs">Files and plans created by the agent will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-12 items-center border-b px-4 font-bold">
        Artifacts
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-4">
          {/* Todos / Plan Section */}
          {todos.length > 0 && (
            <Collapsible open={isTodosOpen} onOpenChange={setIsTodosOpen} className="space-y-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-2 py-1 h-8 hover:bg-muted">
                  <div className="flex items-center gap-2">
                    <List className="size-4 text-primary" />
                    <span className="text-sm font-semibold">Active Plan</span>
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      {todos.filter(t => t.status === "done").length}/{todos.length}
                    </Badge>
                  </div>
                  {isTodosOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1.5 pl-2">
                {todos.map((todo, i) => (
                  <div key={i} className="flex items-start gap-2 py-0.5">
                    {todo.status === "done" ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                    ) : todo.status === "in_progress" ? (
                      <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" />
                    ) : (
                      <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className={cn(
                      "text-xs leading-tight",
                      todo.status === "done" && "text-muted-foreground line-through"
                    )}>
                      {todo.content}
                    </span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Files Section */}
          {filePaths.length > 0 && (
            <Collapsible open={isFilesOpen} onOpenChange={setIsFilesOpen} className="space-y-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-2 py-1 h-8 hover:bg-muted">
                  <div className="flex items-center gap-2">
                    <FileCode className="size-4 text-primary" />
                    <span className="text-sm font-semibold">Files</span>
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      {filePaths.length}
                    </Badge>
                  </div>
                  {isFilesOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pr-1">
                {filePaths.map((path) => (
                  <div key={path} className="group flex items-center justify-between rounded-md border bg-card p-2 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-xs font-medium">{path.split("/").pop()}</span>
                        <span className="truncate text-[10px] text-muted-foreground">{path}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => downloadFile(path, files[path])}
                    >
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
