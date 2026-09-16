"use client";

import * as React from "react";
import { FolderOpenIcon } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspaceFiles } from "@personaai/react";
import { FileExplorerEditor, type ExplorerItem } from "@/components/file-explorer/file-explorer-editor";

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, "");
}

function toBackendPath(path: string): string {
  return `/${stripLeadingSlash(path)}`;
}

export interface WorkspaceFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string | undefined;
  /** Jump straight to this file once the dialog is showing — e.g. a present_file "Open" click. Leading slash optional. */
  initialOpenPath?: string | null;
}

type WorkspaceItem = ExplorerItem;

/**
 * File-explorer-style dialog over one Thread's workspace files (the
 * agent's own virtual filesystem) — the same VS Code-style tree/tabs/editor
 * shell as the platform's own Skill/Agent bundle editor
 * (`FileExplorerEditor`), backed directly by `@personaai/react`'s
 * `useWorkspaceFiles` instead of a parallel type/adapter layer. Always
 * exactly one item ("workspace"), so the Explorer's "+ new item" affordance
 * is omitted (`onCreateItem` left unset) — new files are created via the
 * item's own "+ Add file" link, same as the platform's editor.
 */
export function WorkspaceFilesDialog({
  open,
  onOpenChange,
  threadId,
  initialOpenPath,
}: WorkspaceFilesDialogProps) {
  const isMobile = useIsMobile();
  const { files, isLoading, writeFile, deleteFile } = useWorkspaceFiles(threadId, open);
  const [openRequest, setOpenRequest] = React.useState<{ itemId: string; path: string | null } | null>(
    null
  );

  const items = React.useMemo<WorkspaceItem[] | null>(() => {
    if (isLoading && Object.keys(files).length === 0) return null;
    return [
      {
        id: "workspace",
        name: "workspace",
        files: Object.entries(files)
          .map(([path, file]) => ({ path: stripLeadingSlash(path), content: file.content }))
          .sort((a, b) => a.path.localeCompare(b.path)),
      },
    ];
  }, [files, isLoading]);

  // A present_file "Open" click always jumps straight to that file, every
  // time it changes — not just once per dialog open.
  React.useEffect(() => {
    if (open && initialOpenPath) {
      setOpenRequest({ itemId: "workspace", path: stripLeadingSlash(initialOpenPath) });
    }
  }, [open, initialOpenPath]);

  const handleSaveFile = React.useCallback(
    async (_item: WorkspaceItem, path: string, content: string) => {
      await writeFile(toBackendPath(path), content);
    },
    [writeFile]
  );

  const handleAddFile = React.useCallback(
    async (_item: WorkspaceItem, path: string) => {
      await writeFile(toBackendPath(path), "");
    },
    [writeFile]
  );

  const handleDeleteFile = React.useCallback(
    async (_item: WorkspaceItem, path: string) => {
      await deleteFile(toBackendPath(path));
    },
    [deleteFile]
  );

  const handleDeleteItem = React.useCallback(async () => {
    for (const path of Object.keys(files)) {
      await deleteFile(path).catch(() => {});
    }
  }, [files, deleteFile]);

  const explorer = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <FileExplorerEditor<WorkspaceItem>
        items={items}
        itemLabelPlural="workspace"
        onSaveRoot={async () => {}}
        onSaveFile={handleSaveFile}
        onDeleteItem={handleDeleteItem}
        onAddFile={handleAddFile}
        onDeleteFile={handleDeleteFile}
        openRequest={openRequest}
        emptyStateTitle="No file open"
        emptyStateDescription="Select a file from the explorer tree, or use '+ Add file' to create one."
        addFilePlaceholder={() => "e.g. outputs/report.md or notes.txt"}
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
                Workspace files
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                The agent&apos;s own virtual filesystem for this conversation.
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
              Workspace files
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              The agent&apos;s own virtual filesystem for this conversation.
            </DialogDescription>
          </div>
        </DialogHeader>
        {explorer}
      </DialogContent>
    </Dialog>
  );
}
