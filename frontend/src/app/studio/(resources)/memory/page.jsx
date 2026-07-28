"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getAllMemory,
  writeMemoryFile,
  deleteMemoryFile,
  clearAllMemory,
} from "@/lib/api/memory";
import { getMyMcps } from "@/lib/api/mcps";
import { toast } from "sonner";
import {
  Brain,
  Plus,
  Trash2,
  Loader2,
  Check,
  X,
  Sparkles,
  Bot,
  BookText,
  Pencil,
  SearchIcon,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function fileId(file) {
  return `${file.scope}:${file.agentId || ""}:${file.path}`;
}

function MemoryFileRow({
  file,
  agentName,
  editing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}) {
  const [draft, setDraft] = useState(file.content);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setDraft(file.content);
  }, [editing, file.content]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onCancelEdit();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-150/60 dark:border-zinc-900/60 p-3 bg-card hover:bg-zinc-50/30 dark:hover:bg-zinc-900/10 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="size-3.5 text-primary shrink-0" />
            <span className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 truncate">
              {file.path}
            </span>
            {agentName && (
              <Badge
                variant="outline"
                className="text-[9px] font-bold px-1.5 py-0 rounded-full"
              >
                <Bot className="size-2.5 mr-1" />
                {agentName}
              </Badge>
            )}
            {file.updatedAt && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(file.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          {editing ? (
            <div className="space-y-2 mt-1">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="text-xs font-mono min-h-[120px]"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="h-7 rounded-full text-xs font-bold"
                >
                  {saving ? (
                    <Loader2 className="size-3 mr-1 animate-spin" />
                  ) : (
                    <Check className="size-3 mr-1" />
                  )}
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancelEdit}
                  className="h-7 rounded-full text-xs"
                >
                  <X className="size-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <pre className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
              {file.content}
            </pre>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={onStartEdit}
              className="size-7 rounded-full text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              className="size-7 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MemoryDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newFile, setNewFile] = useState({
    scope: "user",
    agentId: "",
    path: "",
    content: "",
  });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [memRes, mcpRes] = await Promise.all([
        getAllMemory(),
        getMyMcps().catch(() => ({ data: { data: [] } })),
      ]);
      setData(memRes.data?.data);
      setAgents(mcpRes.data?.data || []);
    } catch (err) {
      toast.error("Failed to load memory data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const userFiles = (data?.userFiles || []).map((f) => ({
    ...f,
    scope: "user",
  }));
  const agentGroups = data?.agentMemories || [];

  // Derive agent options from both agents list AND any agents already in memories
  const allAgents = (() => {
    const agentMap = {};
    for (const agent of agents) {
      agentMap[agent._id || agent.id] = agent.name;
    }
    for (const group of agentGroups) {
      if (group.agentId && !agentMap[group.agentId]) {
        agentMap[group.agentId] = group.agentName || "Unknown Agent";
      }
    }
    return Object.entries(agentMap).map(([id, name]) => ({ id, name }));
  })();

  const matchesSearch = (file, agentName) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (file.path || "").toLowerCase().includes(q) ||
      (file.content || "").toLowerCase().includes(q) ||
      (agentName || "").toLowerCase().includes(q)
    );
  };

  const filteredUserFiles = userFiles.filter((f) => matchesSearch(f, null));
  const filteredAgentGroups = agentGroups
    .map((group) => ({
      ...group,
      files: (group.files || []).filter((f) =>
        matchesSearch(f, group.agentName),
      ),
    }))
    .filter((group) => group.files.length > 0);
  const agentFileCount = agentGroups.reduce(
    (sum, g) => sum + (g.files?.length || 0),
    0,
  );

  const handleCreate = async () => {
    if (!newFile.path.trim() || !newFile.content.trim()) {
      toast.error("File path and content are required");
      return;
    }
    if (newFile.scope === "agent" && !newFile.agentId) {
      toast.error("Select an agent for agent-scoped memory");
      return;
    }
    setCreating(true);
    try {
      await writeMemoryFile({
        scope: newFile.scope,
        agentId: newFile.scope === "agent" ? newFile.agentId : undefined,
        path: newFile.path.trim(),
        content: newFile.content,
      });
      toast.success("Memory file saved");
      setShowNewForm(false);
      setNewFile({ scope: "user", agentId: "", path: "", content: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save memory file");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async (file, content) => {
    try {
      await writeMemoryFile({
        scope: file.scope,
        agentId: file.scope === "agent" ? file.agentId : undefined,
        path: file.path,
        content,
      });
      toast.success("Memory file updated");
      fetchData();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to update memory file",
      );
      throw err;
    }
  };

  const handleDelete = async (file) => {
    if (
      !window.confirm(
        `Delete memory file "${file.path}"? This cannot be undone.`,
      )
    )
      return;
    try {
      await deleteMemoryFile({
        scope: file.scope,
        agentId: file.scope === "agent" ? file.agentId : undefined,
        path: file.path,
      });
      toast.success("Memory file deleted");
      fetchData();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to delete memory file",
      );
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await clearAllMemory();
      toast.success("All memory cleared successfully");
      setShowClearDialog(false);
      setData({ userFiles: [], agentMemories: [] });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to clear memory");
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-48 rounded-2xl w-full" />
        <Skeleton className="h-64 rounded-2xl w-full" />
      </div>
    );
  }

  const hasNoMemories = userFiles.length === 0 && agentFileCount === 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            AI Memory Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Memory is stored as markdown files your agents read and update
            across conversations.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewForm(!showNewForm)}
          className="rounded-full font-bold"
        >
          <Plus className="size-4 mr-1.5" />
          New Memory File
        </Button>
      </div>

      {/* Create Form */}
      {showNewForm && (
        <Card className="border border-zinc-150/60 dark:border-zinc-900/60 rounded-3xl">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              Create Memory File
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Scope
                </label>
                <select
                  value={newFile.scope}
                  onChange={(e) =>
                    setNewFile((p) => ({ ...p, scope: e.target.value }))
                  }
                  className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-background px-3 text-xs"
                >
                  <option value="user">User (all agents)</option>
                  <option value="agent">Agent-specific</option>
                </select>
              </div>
              {newFile.scope === "agent" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Agent
                  </label>
                  <select
                    value={newFile.agentId}
                    onChange={(e) =>
                      setNewFile((p) => ({ ...p, agentId: e.target.value }))
                    }
                    className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-background px-3 text-xs"
                  >
                    <option value="">Select agent...</option>
                    {allAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  File Path
                </label>
                <Input
                  placeholder="e.g. /preferences.md"
                  value={newFile.path}
                  onChange={(e) =>
                    setNewFile((p) => ({ ...p, path: e.target.value }))
                  }
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Content (markdown)
              </label>
              <Textarea
                placeholder={
                  "- Prefers concise answers\n- Works with Next.js and Tailwind"
                }
                value={newFile.content}
                onChange={(e) =>
                  setNewFile((p) => ({ ...p, content: e.target.value }))
                }
                className="text-xs font-mono min-h-[100px]"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating}
                className="rounded-full font-bold"
              >
                {creating && (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                )}
                Save File
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewForm(false)}
                className="rounded-full"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasNoMemories ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 border border-zinc-150/60 dark:border-zinc-900 rounded-[28px] bg-zinc-50/50 dark:bg-zinc-900/10 text-center select-none max-w-2xl mx-auto">
          <div className="size-16 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-5 text-zinc-400 dark:text-zinc-600">
            <Brain className="size-8" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">
            No memories stored yet
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm leading-relaxed font-medium">
            Agents save memory files automatically as they learn during
            conversations, or you can create files manually.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search memory files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* User Memory Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 rounded-3xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Sparkles className="size-4 text-indigo-500" />
                      User Memory
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Files shared with all of your agents (/memories/user/).
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    {userFiles.length} files
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {filteredUserFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    {search
                      ? "No user memory files match your search."
                      : "No user memory files yet. They are created as agents learn about you."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredUserFiles.map((file) => (
                      <MemoryFileRow
                        key={fileId(file)}
                        file={file}
                        editing={editingId === fileId(file)}
                        onStartEdit={() => setEditingId(fileId(file))}
                        onCancelEdit={() => setEditingId(null)}
                        onSave={(content) => handleSaveEdit(file, content)}
                        onDelete={() => handleDelete(file)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agent Memories Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 rounded-3xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Brain className="size-4 text-primary" />
                      Agent Memories
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Per-agent memory files (/memories/agent/), private to you.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    {agentFileCount} files
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {filteredAgentGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/20 dark:bg-zinc-900/5 text-center">
                    <Brain className="size-6 text-zinc-400 mb-2" />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                      {search
                        ? "No agent memory files match your search."
                        : "No agent memory files yet. They're created as agents learn during conversations."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {filteredAgentGroups.map((group) => (
                      <div key={group.agentId} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          >
                            <Bot className="size-3 mr-1" />
                            {group.agentName || "Unknown Agent"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {group.files.length} file
                            {group.files.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {group.files.map((file) => {
                            const enriched = {
                              ...file,
                              scope: "agent",
                              agentId: group.agentId,
                            };
                            return (
                              <MemoryFileRow
                                key={fileId(enriched)}
                                file={enriched}
                                editing={editingId === fileId(enriched)}
                                onStartEdit={() =>
                                  setEditingId(fileId(enriched))
                                }
                                onCancelEdit={() => setEditingId(null)}
                                onSave={(content) =>
                                  handleSaveEdit(enriched, content)
                                }
                                onDelete={() => handleDelete(enriched)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 rounded-3xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Brain className="size-4 text-primary" />
                Overview
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    User Memory Files
                  </span>
                  <Badge variant="secondary" className="rounded-full">
                    {userFiles.length}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Agent Memory Files
                  </span>
                  <Badge variant="secondary" className="rounded-full">
                    {agentFileCount}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Agents with Memory
                  </span>
                  <Badge variant="secondary" className="rounded-full">
                    {agentGroups.length}
                  </Badge>
                </div>
              </div>
            </Card>

            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 rounded-3xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <BookText className="size-4 text-primary" />
                How Memory Works
              </h3>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
                <p>
                  <strong className="text-zinc-700 dark:text-zinc-300">
                    User Memory
                  </strong>{" "}
                  — Markdown files under{" "}
                  <code className="font-mono">/memories/user/</code>, shared
                  across all your agents. The{" "}
                  <code className="font-mono">index.md</code> file is loaded
                  into every conversation automatically.
                </p>
                <p>
                  <strong className="text-zinc-700 dark:text-zinc-300">
                    Agent Memory
                  </strong>{" "}
                  — Files under{" "}
                  <code className="font-mono">/memories/agent/</code>, kept
                  separately for each agent you talk to. Agents update these
                  with the same file tools they use for everything else.
                </p>
                <p>
                  You can view, edit, and delete any memory file from this
                  dashboard.
                </p>
              </div>
            </Card>

            {/* Clear All Memory */}
            <Card className="border border-destructive/20 dark:border-destructive/10 rounded-3xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
                <AlertTriangle className="size-4" />
                Danger Zone
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Permanently delete every memory file — user memory and all
                per-agent memories. This action cannot be undone.
              </p>
              <Button
                variant="ghost"
                className="w-full h-9 font-bold text-xs rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 border border-destructive/20 uppercase tracking-wider"
                onClick={() => setShowClearDialog(true)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Clear All Memory
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Clear All Memory?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>all</strong> of the
              following:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-xs text-muted-foreground space-y-2 px-1">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-indigo-500" />
              All user memory files (shared across agents)
            </div>
            <div className="flex items-center gap-2">
              <Brain className="size-3.5 text-primary" />
              All per-agent memory files (every agent)
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5 mr-1.5" />
                  Yes, Clear Everything
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
