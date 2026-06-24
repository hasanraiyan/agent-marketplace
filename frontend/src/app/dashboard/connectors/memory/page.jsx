"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnectors } from "../connectors-context";
import { getAllMemory, createMemory, updateMemory, deleteMemoryEntry, clearAllMemory } from "@/lib/api/memory";
import { getMyMcps } from "@/lib/api/mcps";
import { toast } from "sonner";
import {
  Brain,
  Plus,
  Trash2,
  Loader2,
  Edit3,
  Check,
  X,
  Sparkles,
  Bot,
  BookText,
  Pencil,
  SearchIcon,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export default function MemoryDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMemory, setNewMemory] = useState({ agentId: "", key: "", value: "" });
  const [creating, setCreating] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
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

  // Derive agent options from both agents list AND any agents already in memories
  const allAgents = (() => {
    const agentMap = {};
    for (const agent of agents) {
      agentMap[agent._id || agent.id] = agent.name;
    }
    if (data?.agentMemories) {
      for (const mem of data.agentMemories) {
        if (mem.agentId && !agentMap[mem.agentId]) {
          agentMap[mem.agentId] = mem.agentName;
        }
      }
    }
    return Object.entries(agentMap).map(([id, name]) => ({ id, name }));
  })();

  const handleCreate = async () => {
    if (!newMemory.agentId || !newMemory.key.trim() || !newMemory.value.trim()) {
      toast.error("Agent, key, and value are required");
      return;
    }
    setCreating(true);
    try {
      await createMemory({
        agentId: newMemory.agentId,
        key: newMemory.key.trim(),
        value: newMemory.value.trim(),
      });
      toast.success("Memory created");
      setShowNewForm(false);
      setNewMemory({ agentId: "", key: "", value: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create memory");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (agentId, key) => {
    if (!editValue.trim()) {
      toast.error("Value is required");
      return;
    }
    setSavingEdit(true);
    try {
      await updateMemory(agentId, key, { value: editValue.trim() });
      toast.success("Memory updated");
      setEditingKey(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update memory");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await clearAllMemory();
      toast.success("All memory cleared successfully");
      setShowClearDialog(false);
      setData({
        profile: { summary: "", preferences: {} },
        agentMemories: [],
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to clear memory");
    } finally {
      setIsClearing(false);
    }
  };

  const handleDelete = async (agentId, key) => {
    if (!window.confirm(`Delete memory "${key}"? This cannot be undone.`)) return;
    try {
      await deleteMemoryEntry(agentId, key);
      toast.success("Memory deleted");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete memory");
    }
  };

  const filteredMemories = (data?.agentMemories || []).filter((mem) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (mem.key || "").toLowerCase().includes(q) ||
      String(mem.value || "").toLowerCase().includes(q) ||
      (mem.agentName || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-48 rounded-2xl w-full" />
        <Skeleton className="h-64 rounded-2xl w-full" />
      </div>
    );
  }

  const profile = data?.profile || { summary: "", preferences: {} };
  const prefEntries = Object.entries(profile.preferences || {});
  const hasNoMemories = filteredMemories.length === 0 && prefEntries.length === 0 && !profile.summary;

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
            Centralized view of user profile memory and all agent long-term memories.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewForm(!showNewForm)}
          className="rounded-full font-bold"
        >
          <Plus className="size-4 mr-1.5" />
          New Memory
        </Button>
      </div>

      {/* Create Form */}
      {showNewForm && (
        <Card className="border border-zinc-150/60 dark:border-zinc-900/60 rounded-3xl">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              Create Agent Memory
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Agent</label>
                <select
                  value={newMemory.agentId}
                  onChange={(e) => setNewMemory((p) => ({ ...p, agentId: e.target.value }))}
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
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Key</label>
                <Input
                  placeholder="e.g. resolved_pattern"
                  value={newMemory.key}
                  onChange={(e) => setNewMemory((p) => ({ ...p, key: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Value</label>
                <Input
                  placeholder="e.g. Use functional components"
                  value={newMemory.value}
                  onChange={(e) => setNewMemory((p) => ({ ...p, value: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={handleCreate} disabled={creating} className="rounded-full font-bold">
                {creating && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                Create
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)} className="rounded-full">
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
            Memories are created automatically as your agents interact with users,
            or you can add them manually below.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: User Profile Memory */}
          <div className="space-y-6 lg:col-span-2">
            {/* User Profile Memory Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 rounded-3xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="size-4 text-indigo-500" />
                  User Profile Memory
                </CardTitle>
                <CardDescription className="text-xs">
                  Summary and preferences extracted from your conversations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.summary ? (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Summary
                    </p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl p-3 border">
                      {profile.summary}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No profile summary yet. It will be generated as you interact with agents.
                  </p>
                )}

                {prefEntries.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Preferences ({prefEntries.length})
                    </p>
                    <div className="grid gap-2">
                      {prefEntries.map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-xl border border-zinc-150/60 dark:border-zinc-900/60 p-3 bg-zinc-50/30 dark:bg-zinc-900/10"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Sparkles className="size-3.5 text-indigo-500 shrink-0" />
                            <span className="text-xs font-semibold font-mono text-zinc-700 dark:text-zinc-300 truncate">
                              {key}
                            </span>
                            <span className="text-xs text-muted-foreground">→</span>
                            <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                              {String(value)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
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
                      Long-term memories stored across all your agents.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    {data?.agentMemories?.length || 0} items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search */}
                {filteredMemories.length > 0 && (
                  <div className="mb-4">
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search memories..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                )}

                {filteredMemories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/20 dark:bg-zinc-900/5 text-center">
                    <Brain className="size-6 text-zinc-400 mb-2" />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                      {search
                        ? "No memories match your search."
                        : "No agent memories yet. They're created as agents learn during conversations."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredMemories.map((mem) => {
                      const isEditing = editingKey === `${mem.agentId}:${mem.key}`;
                      return (
                        <div
                          key={`${mem.agentId}:${mem.key}`}
                          className="rounded-xl border border-zinc-150/60 dark:border-zinc-900/60 p-3 bg-card hover:bg-zinc-50/30 dark:hover:bg-zinc-900/10 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 rounded-full">
                                  <Bot className="size-2.5 mr-1" />
                                  {mem.agentName}
                                </Badge>
                                <span className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                  {mem.key}
                                </span>
                                {mem.updatedAt && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(mem.updatedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              {isEditing ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="h-8 text-xs flex-1"
                                    autoFocus
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleEdit(mem.agentId, mem.key)}
                                    disabled={savingEdit}
                                    className="size-7 rounded-full text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                  >
                                    {savingEdit ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Check className="size-3.5" />
                                    )}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setEditingKey(null)}
                                    className="size-7 rounded-full text-muted-foreground hover:text-foreground"
                                  >
                                    <X className="size-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                  {typeof mem.value === "object"
                                    ? JSON.stringify(mem.value)
                                    : String(mem.value)}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingKey(`${mem.agentId}:${mem.key}`);
                                  setEditValue(
                                    typeof mem.value === "object"
                                      ? JSON.stringify(mem.value)
                                      : String(mem.value)
                                  );
                                }}
                                className="size-7 rounded-full text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(mem.agentId, mem.key)}
                                className="size-7 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar: Summary Card */}
          <div className="space-y-6">
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 rounded-3xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Brain className="size-4 text-primary" />
                Overview
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Profile Summary</span>
                  <Badge variant="secondary" className="rounded-full">
                    {profile.summary ? "Present" : "Empty"}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">User Preferences</span>
                  <Badge variant="secondary" className="rounded-full">
                    {prefEntries.length}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Agent Memories</span>
                  <Badge variant="secondary" className="rounded-full">
                    {data?.agentMemories?.length || 0}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Agents with Memory</span>
                  <Badge variant="secondary" className="rounded-full">
                    {new Set((data?.agentMemories || []).map((m) => m.agentId)).size}
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
                  <strong className="text-zinc-700 dark:text-zinc-300">User Memory</strong> — Profile
                  summary and preferences are automatically extracted from your conversations and saved
                  to your profile. You can also edit them in Settings.
                </p>
                <p>
                  <strong className="text-zinc-700 dark:text-zinc-300">Agent Memory</strong> — Each
                  agent can save key-value facts and learnings that persist across all conversations.
                  These are stored per-agent in the agent_memories collection.
                </p>
                <p>
                  You can manually create, edit, and delete any memory entry from this dashboard.
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
                Permanently delete all user profile memory, preferences, and all agent
                long-term memories across every agent. This action cannot be undone.
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
              This will permanently delete <strong>all</strong> of the following:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-xs text-muted-foreground space-y-2 px-1">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-indigo-500" />
              User profile summary and all preferences
            </div>
            <div className="flex items-center gap-2">
              <Brain className="size-3.5 text-primary" />
              All agent long-term memories (every agent, every key)
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
