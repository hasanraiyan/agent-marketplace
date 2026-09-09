"use client";

import * as React from "react";
import { BrainIcon, SparkleIcon, RobotIcon, InfoIcon } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  FileExplorerEditor,
  type ExplorerItem,
  type ExplorerFile,
} from "@/components/file-explorer/file-explorer-editor";
import {
  getProjectMemory,
  writeProjectMemoryFile,
  deleteProjectMemoryFile,
  clearProjectMemory,
} from "@/lib/api/projects";

interface MemoryFileDto {
  scope: "user" | "agent";
  agentId?: string;
  path: string;
  content: string;
  mimeType?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface MemoryDataResponse {
  userFiles: MemoryFileDto[];
  agentMemories: Array<{
    agentId: string;
    agentName: string | null;
    files: MemoryFileDto[];
  }>;
}

interface MemoryItem extends ExplorerItem {
  scope: "user" | "agent";
  agentId?: string;
  agentName?: string;
}

interface MemoryWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  activeAgentId?: string | null;
  agents: Array<{ id: string; name: string }>;
}

const SHARED_ITEM_ID = "__shared_project_memory__";
const ROOT_FILE_NAME = "index.md";

function normalizePath(raw: string): string {
  const clean = raw.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  return `/${clean}`;
}

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, "");
}

export function MemoryWorkspaceDialog({
  open,
  onOpenChange,
  projectId,
  activeAgentId,
  agents,
}: MemoryWorkspaceDialogProps) {
  const [memoryData, setMemoryData] = React.useState<MemoryDataResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [openRequest, setOpenRequest] = React.useState<{ itemId: string; path: string | null } | null>(
    null
  );

  const fetchMemory = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProjectMemory(projectId);
      const data = res.data?.data as MemoryDataResponse;
      setMemoryData(data || { userFiles: [], agentMemories: [] });
    } catch {
      setMemoryData({ userFiles: [], agentMemories: [] });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    if (open) {
      fetchMemory();
    }
  }, [open, fetchMemory]);

  // Set initial open tab ONLY ONCE when the dialog opens
  const prevOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      prevOpenRef.current = true;
      const targetItemId =
        activeAgentId && agents.some((a) => String(a.id) === String(activeAgentId))
          ? activeAgentId
          : SHARED_ITEM_ID;

      setOpenRequest({ itemId: targetItemId, path: null });
    } else if (!open) {
      prevOpenRef.current = false;
    }
  }, [open, activeAgentId, agents]);

  // Transform memoryData + agents into ExplorerItems
  const items = React.useMemo<MemoryItem[] | null>(() => {
    if (loading && !memoryData) return null;

    const currentData = memoryData ?? { userFiles: [], agentMemories: [] };

    // 1. Shared Project Memory item
    const userFiles = currentData.userFiles || [];
    const sharedRootDoc = userFiles.find(
      (f) => normalizePath(f.path) === "/index.md"
    );
    const sharedOtherFiles: ExplorerFile[] = userFiles
      .filter((f) => normalizePath(f.path) !== "/index.md")
      .map((f) => ({
        path: stripLeadingSlash(f.path),
        content: f.content || "",
      }));

    const sharedItem: MemoryItem = {
      id: SHARED_ITEM_ID,
      name: "Shared Project Memory",
      rootContent:
        sharedRootDoc?.content ??
        "# Project Memory Index\n\n- Facts, preferences, and guidelines shared across all agents in this project.\n",
      files: sharedOtherFiles,
      scope: "user",
    };

    // 2. Agent Memory items (all project agents)
    const agentItems: MemoryItem[] = agents.map((agent) => {
      const group = (currentData.agentMemories || []).find(
        (g) => String(g.agentId) === String(agent.id)
      );
      const files = group?.files || [];
      const rootDoc = files.find((f) => normalizePath(f.path) === "/index.md");
      const otherFiles: ExplorerFile[] = files
        .filter((f) => normalizePath(f.path) !== "/index.md")
        .map((f) => ({
          path: stripLeadingSlash(f.path),
          content: f.content || "",
        }));

      return {
        id: agent.id,
        name: agent.name,
        rootContent:
          rootDoc?.content ??
          `# Agent Memory Index (${agent.name})\n\n- Specific patterns, learnings, and configs for ${agent.name}.\n`,
        files: otherFiles,
        scope: "agent",
        agentId: agent.id,
        agentName: agent.name,
      };
    });

    return [sharedItem, ...agentItems];
  }, [loading, memoryData, agents]);

  // CRUD Handlers
  const handleSaveRoot = async (item: MemoryItem, content: string) => {
    const isShared = item.id === SHARED_ITEM_ID;
    await writeProjectMemoryFile(projectId, {
      scope: isShared ? "user" : "agent",
      agentId: isShared ? undefined : item.id,
      path: "/index.md",
      content,
    });

    setMemoryData((prev) => {
      if (!prev) return prev;
      if (isShared) {
        const otherFiles = (prev.userFiles || []).filter(
          (f) => normalizePath(f.path) !== "/index.md"
        );
        return {
          ...prev,
          userFiles: [
            ...otherFiles,
            { scope: "user", path: "/index.md", content, updatedAt: new Date().toISOString() },
          ],
        };
      } else {
        const groups = [...(prev.agentMemories || [])];
        const idx = groups.findIndex((g) => String(g.agentId) === String(item.id));
        const rootObj = {
          scope: "agent" as const,
          agentId: item.id,
          path: "/index.md",
          content,
          updatedAt: new Date().toISOString(),
        };
        if (idx >= 0) {
          const otherFiles = (groups[idx].files || []).filter(
            (f) => normalizePath(f.path) !== "/index.md"
          );
          groups[idx] = {
            ...groups[idx],
            files: [...otherFiles, rootObj],
          };
        } else {
          groups.push({
            agentId: item.id,
            agentName: item.name,
            files: [rootObj],
          });
        }
        return { ...prev, agentMemories: groups };
      }
    });
  };

  const handleSaveFile = async (item: MemoryItem, rawPath: string, content: string) => {
    const isShared = item.id === SHARED_ITEM_ID;
    const path = normalizePath(rawPath);

    await writeProjectMemoryFile(projectId, {
      scope: isShared ? "user" : "agent",
      agentId: isShared ? undefined : item.id,
      path,
      content,
    });

    setMemoryData((prev) => {
      if (!prev) return prev;
      if (isShared) {
        const otherFiles = (prev.userFiles || []).filter((f) => normalizePath(f.path) !== path);
        return {
          ...prev,
          userFiles: [
            ...otherFiles,
            { scope: "user", path, content, updatedAt: new Date().toISOString() },
          ],
        };
      } else {
        const groups = [...(prev.agentMemories || [])];
        const idx = groups.findIndex((g) => String(g.agentId) === String(item.id));
        const fileObj: MemoryFileDto = {
          scope: "agent" as const,
          agentId: item.id,
          path,
          content,
          updatedAt: new Date().toISOString(),
        };
        if (idx >= 0) {
          const otherFiles = (groups[idx].files || []).filter((f) => normalizePath(f.path) !== path);
          groups[idx] = {
            ...groups[idx],
            files: [...otherFiles, fileObj],
          };
        } else {
          groups.push({
            agentId: item.id,
            agentName: item.name,
            files: [fileObj],
          });
        }
        return { ...prev, agentMemories: groups };
      }
    });
  };

  const handleAddFile = async (item: MemoryItem, rawPath: string) => {
    const isShared = item.id === SHARED_ITEM_ID;
    const path = normalizePath(rawPath);
    const cleanPath = stripLeadingSlash(path);
    const initialContent = `# ${cleanPath.split("/").pop() || "Topic"}\n\n`;

    await writeProjectMemoryFile(projectId, {
      scope: isShared ? "user" : "agent",
      agentId: isShared ? undefined : item.id,
      path,
      content: initialContent,
    });

    setMemoryData((prev) => {
      if (!prev) return prev;
      if (isShared) {
        const otherFiles = (prev.userFiles || []).filter((f) => normalizePath(f.path) !== path);
        return {
          ...prev,
          userFiles: [
            ...otherFiles,
            { scope: "user", path, content: initialContent, updatedAt: new Date().toISOString() },
          ],
        };
      } else {
        const groups = [...(prev.agentMemories || [])];
        const idx = groups.findIndex((g) => String(g.agentId) === String(item.id));
        const newFile: MemoryFileDto = {
          scope: "agent",
          agentId: item.id,
          path,
          content: initialContent,
          updatedAt: new Date().toISOString(),
        };
        if (idx >= 0) {
          const otherFiles = (groups[idx].files || []).filter((f) => normalizePath(f.path) !== path);
          groups[idx] = {
            ...groups[idx],
            files: [...otherFiles, newFile],
          };
        } else {
          groups.push({
            agentId: item.id,
            agentName: item.name,
            files: [newFile],
          });
        }
        return { ...prev, agentMemories: groups };
      }
    });

    // Explicitly focus and open the newly added file tab
    setOpenRequest({ itemId: item.id, path: cleanPath });
  };

  const handleDeleteFile = async (item: MemoryItem, rawPath: string) => {
    const isShared = item.id === SHARED_ITEM_ID;
    const path = normalizePath(rawPath);

    await deleteProjectMemoryFile(projectId, {
      scope: isShared ? "user" : "agent",
      agentId: isShared ? undefined : item.id,
      path,
    });

    setMemoryData((prev) => {
      if (!prev) return prev;
      if (isShared) {
        return {
          ...prev,
          userFiles: (prev.userFiles || []).filter((f) => normalizePath(f.path) !== path),
        };
      } else {
        const groups = (prev.agentMemories || []).map((g) => {
          if (String(g.agentId) !== String(item.id)) return g;
          return {
            ...g,
            files: (g.files || []).filter((f) => normalizePath(f.path) !== path),
          };
        });
        return { ...prev, agentMemories: groups };
      }
    });
  };

  const handleDeleteItem = async (item: MemoryItem) => {
    const isShared = item.id === SHARED_ITEM_ID;
    if (isShared) {
      // Clear all project memory files
      await clearProjectMemory(projectId);
      setMemoryData({ userFiles: [], agentMemories: [] });
    } else {
      await clearProjectMemory(projectId, item.id);
      setMemoryData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          agentMemories: (prev.agentMemories || []).filter((g) => g.agentId !== item.id),
        };
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl w-[95vw] h-[86vh] p-0 flex flex-col gap-0 overflow-hidden outline-none">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-3 bg-muted/20 shrink-0">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex size-6 items-center justify-center rounded-none bg-primary text-primary-foreground">
                <BrainIcon className="size-3.5" />
              </span>
              Project Memory Workspace
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Manage persistent memory files (/memories/user/ and /memories/agent/) loaded during agent runs.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <FileExplorerEditor<MemoryItem>
            items={items}
            itemLabelPlural="memory scopes"
            rootFileName={ROOT_FILE_NAME}
            onCreateItem={() => {
              // Focus shared project memory
              setOpenRequest({ itemId: SHARED_ITEM_ID, path: null });
            }}
            onSaveRoot={handleSaveRoot}
            onSaveFile={handleSaveFile}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
            onDeleteItem={handleDeleteItem}
            openRequest={openRequest}
            emptyStateTitle="No memory file open"
            emptyStateDescription="Select a memory file from the explorer tree or open index.md to inspect persistent memories."
            renderTabExtras={(item) => (
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-mono tracking-wide px-1.5 py-0 rounded-none bg-muted/50"
              >
                {item.scope === "user" ? (
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
            )}
            renderSidePanel={(item) => (
              <div className="p-4 space-y-4 text-xs">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                    Memory Scope
                  </span>
                  <p className="font-medium text-foreground">
                    {item.scope === "user" ? "Project-wide (Shared)" : item.name}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                    Filesystem Route
                  </span>
                  <code className="block rounded bg-muted/60 p-2 font-mono text-[11px] text-foreground break-all">
                    {item.scope === "user"
                      ? "/memories/user/"
                      : `/memories/agent/`}
                  </code>
                </div>

                <div className="rounded border border-border/80 bg-card p-3 space-y-2 text-muted-foreground">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-[11px]">
                    <InfoIcon className="size-3.5 text-primary shrink-0" />
                    Auto-load Rules
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    <strong className="text-foreground">index.md</strong> is automatically injected into every conversation turn.
                    Agents can read additional topic files when relevant.
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-border/60">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                    Files in Scope
                  </span>
                  <p className="text-xs font-mono text-muted-foreground">
                    {1 + (item.files?.length || 0)} file(s)
                  </p>
                </div>
              </div>
            )}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
