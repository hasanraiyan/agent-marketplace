"use client";

import * as React from "react";
import { FolderOpenIcon, RobotIcon, SparkleIcon } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemory, type PersonaMemoryFile } from "@personaai/react";
import { FileExplorerEditor, type ExplorerItem } from "@/components/file-explorer/file-explorer-editor";

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, "");
}

function toBackendPath(path: string): string {
  return `/${stripLeadingSlash(path)}`;
}

type MemoryScope = NonNullable<PersonaMemoryFile["scope"]>;

/** `memories/agent/...` and `memories/user/...` map to real scope+path; `workspace/...` doesn't need unprefixing (its own item). */
function resolveMemoriesPath(path: string): { scope: Extract<MemoryScope, "agent" | "user">; path: string } {
  const clean = stripLeadingSlash(path);
  if (clean.startsWith("agent/")) return { scope: "agent", path: toBackendPath(clean.slice("agent/".length)) };
  return { scope: "user", path: toBackendPath(clean.startsWith("user/") ? clean.slice("user/".length) : clean) };
}

export interface MemoryWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The Agent whose memory/workspace to show. Workspace files are scoped by
   * Agent + Subject (shared across every conversation with that Agent);
   * agent-scoped memory is scoped the same way; user-scoped memory applies
   * across every Agent this Subject talks to.
   */
  agentId: string | undefined;
  /** Jump straight to this workspace file once the dialog is showing — e.g. a present_file "Open" click. Leading slash optional. */
  initialOpenPath?: string | null;
}

type MemoryWorkspaceItem = ExplorerItem;

/**
 * File-explorer-style dialog over both a Subject's memory (`/memories/user/`
 * shared across every Agent, `/memories/agent/` scoped to this one Agent)
 * and this Agent's `/workspace/` files — the SAME two persistent stores an
 * Agent's own `write_file`/`read_file` tool calls actually read and write
 * (NOT a Thread's LangGraph checkpoint state, a different, much narrower
 * thing). Same VS Code-style tree/tabs/editor shell as the platform's own
 * Skill/Agent bundle editor (`FileExplorerEditor`) and the same two-item
 * shape as the platform's own `MemoryWorkspaceDialog` — backed directly by
 * `@personaai/react`'s `useMemory` instead of a parallel type/adapter layer.
 * No "+ new item" affordance (`onCreateItem` left unset): the two items are
 * fixed, new files are created via each item's own "+ Add file" link.
 */
export function MemoryWorkspaceDialog({
  open,
  onOpenChange,
  agentId,
  initialOpenPath,
}: MemoryWorkspaceDialogProps) {
  const isMobile = useIsMobile();
  const { memory, isLoading, writeFile, deleteFile } = useMemory(open);
  const [openRequest, setOpenRequest] = React.useState<{ itemId: string; path: string | null } | null>(
    null
  );

  const items = React.useMemo<MemoryWorkspaceItem[] | null>(() => {
    if (
      isLoading &&
      memory.userFiles.length === 0 &&
      memory.agentMemories.length === 0 &&
      memory.agentWorkspaces.length === 0
    ) {
      return null;
    }
    if (!agentId) return [];

    const agentGroup = memory.agentMemories.find((g) => g.agentId === agentId);
    const workspaceGroup = memory.agentWorkspaces.find((g) => g.agentId === agentId);

    const memoriesFiles = [
      ...(agentGroup?.files ?? []).map((f) => ({
        path: `agent/${stripLeadingSlash(f.path)}`,
        content: f.content,
      })),
      ...memory.userFiles.map((f) => ({ path: `user/${stripLeadingSlash(f.path)}`, content: f.content })),
    ].sort((a, b) => a.path.localeCompare(b.path));

    const workspaceFiles = (workspaceGroup?.files ?? [])
      .map((f) => ({ path: stripLeadingSlash(f.path), content: f.content }))
      .sort((a, b) => a.path.localeCompare(b.path));

    return [
      { id: "memories", name: "memories", files: memoriesFiles },
      { id: "workspace", name: "workspace", files: workspaceFiles },
    ];
  }, [memory, isLoading, agentId]);

  // A present_file "Open" click always jumps to that workspace file, every
  // time it changes — not just once per dialog open.
  React.useEffect(() => {
    if (open && initialOpenPath) {
      setOpenRequest({ itemId: "workspace", path: stripLeadingSlash(initialOpenPath) });
    }
  }, [open, initialOpenPath]);

  const handleSaveFile = React.useCallback(
    async (item: MemoryWorkspaceItem, path: string, content: string) => {
      if (item.id === "memories") {
        const { scope, path: backendPath } = resolveMemoriesPath(path);
        await writeFile({ path: backendPath, content, scope, agentId: scope === "agent" ? agentId : undefined });
      } else {
        await writeFile({ path: toBackendPath(path), content, scope: "workspace", agentId });
      }
    },
    [writeFile, agentId]
  );

  const handleAddFile = React.useCallback(
    async (item: MemoryWorkspaceItem, path: string) => {
      await handleSaveFile(item, path, "");
    },
    [handleSaveFile]
  );

  const handleDeleteFile = React.useCallback(
    async (item: MemoryWorkspaceItem, path: string) => {
      if (item.id === "memories") {
        const { scope, path: backendPath } = resolveMemoriesPath(path);
        await deleteFile({ path: backendPath, scope, agentId: scope === "agent" ? agentId : undefined });
      } else {
        await deleteFile({ path: toBackendPath(path), scope: "workspace", agentId });
      }
    },
    [deleteFile, agentId]
  );

  const handleDeleteItem = React.useCallback(
    async (item: MemoryWorkspaceItem) => {
      for (const f of item.files) {
        await handleDeleteFile(item, f.path).catch(() => {});
      }
    },
    [handleDeleteFile]
  );

  const explorer = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <FileExplorerEditor<MemoryWorkspaceItem>
        items={items}
        itemLabelPlural="directories"
        onSaveRoot={async () => {}}
        onSaveFile={handleSaveFile}
        onDeleteItem={handleDeleteItem}
        onAddFile={handleAddFile}
        onDeleteFile={handleDeleteFile}
        openRequest={openRequest}
        emptyStateTitle="No file open"
        emptyStateDescription="Select a file from the explorer tree, or use '+ Add file' to create one."
        addFilePlaceholder={(item) =>
          item?.id === "memories" ? "e.g. agent/notes.md or user/preferences.md" : "e.g. outputs/report.md"
        }
        renderTabExtras={(item, activePath) => {
          if (item.id === "workspace") {
            return (
              <Badge variant="outline" className="rounded-none bg-muted/50 px-1.5 py-0 font-mono text-[10px] uppercase tracking-wide">
                <span className="inline-flex items-center gap-1">
                  <FolderOpenIcon className="size-2.5 text-primary" />
                  Workspace
                </span>
              </Badge>
            );
          }
          const isShared = activePath?.startsWith("user/") ?? false;
          return (
            <Badge variant="outline" className="rounded-none bg-muted/50 px-1.5 py-0 font-mono text-[10px] uppercase tracking-wide">
              {isShared ? (
                <span className="inline-flex items-center gap-1">
                  <SparkleIcon className="size-2.5 text-primary" />
                  Shared
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <RobotIcon className="size-2.5 text-primary" />
                  Agent
                </span>
              )}
            </Badge>
          );
        }}
      />
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex w-full flex-col gap-0 overflow-hidden rounded-t-lg p-0 outline-none data-[side=bottom]:h-[96vh] data-[side=bottom]:min-h-[96vh] data-[side=bottom]:max-h-[96vh]"
        >
          <SheetHeader className="flex shrink-0 flex-row items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <SheetTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <span className="flex size-6 items-center justify-center rounded-none bg-primary text-primary-foreground">
                  <FolderOpenIcon className="size-3.5" />
                </span>
                Memory &amp; Workspace
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                This agent&apos;s shared/agent memory and its /workspace/ files.
              </SheetDescription>
            </div>
          </SheetHeader>
          {explorer}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[86vh] w-[95vw] flex-col gap-0 overflow-hidden p-0 outline-none sm:max-w-7xl">
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-border bg-muted/20 px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex size-6 items-center justify-center rounded-none bg-primary text-primary-foreground">
                <FolderOpenIcon className="size-3.5" />
              </span>
              Memory &amp; Workspace
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This agent&apos;s shared/agent memory and its /workspace/ files.
            </DialogDescription>
          </div>
        </DialogHeader>
        {explorer}
      </DialogContent>
    </Dialog>
  );
}
