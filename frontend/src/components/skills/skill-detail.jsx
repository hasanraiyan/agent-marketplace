"use client";

import { useState, useEffect } from "react";
import {
  Cpu,
  Globe,
  Lock,
  Edit,
  Trash2,
  Calendar,
  User,
  Boxes,
  Star,
  Play,
  Copy,
  Check,
  BadgeCheck,
  Brain,
  MessageSquare,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { deleteSkill, getUsedByAgents } from "@/lib/api/skills";
import { useRouter } from "next/navigation";
import { useConnectors } from "@/app/dashboard/connectors/connectors-context";
import Link from "next/link";

export function SkillDetail({ skill }) {
  const router = useRouter();
  const { refreshSkills, mySkills } = useConnectors();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [usedByAgents, setUsedByAgents] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (skill) {
      getUsedByAgents(skill._id || skill.id)
        .then((res) => setUsedByAgents(res.data?.data || []))
        .catch(err => console.error("Failed to fetch agents using skill", err));
    }
  }, [skill]);

  if (!skill) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Cpu className="size-12 mb-4 opacity-20" />
        <p>Select a skill from the sidebar to view details</p>
      </div>
    );
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSkill(skill._id || skill.id);
      toast.success("Skill deleted successfully");
      refreshSkills();
      router.push("/dashboard/connectors/skills");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete skill");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const skillId = skill._id || skill.id;
  const isOwner =
    skill.isOwner === true ||
    mySkills.some((s) => (s._id || s.id) === skillId);

  const handleCopyText = () => {
    if (typeof window !== "undefined" && skill.instructions) {
      navigator.clipboard.writeText(skill.instructions);
      setCopied(true);
      toast.success("Instructions copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex-grow overflow-y-auto bg-slate-50/40 dark:bg-slate-950/20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Left Column (2/3 width) */}
          <div className="space-y-8 lg:col-span-2">
            {/* Overview / Identity Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none overflow-hidden">
              <CardContent className="px-6 py-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="size-20 sm:size-24 rounded-2xl sm:rounded-3xl border border-zinc-150/60 dark:border-zinc-800 shrink-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                    <Cpu className="size-10 sm:size-12" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge
                        variant={skill.isPublic ? "default" : "outline"}
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      >
                        {skill.isPublic ? (
                          <><Globe className="size-3 mr-1" />Public</>
                        ) : (
                          <><Lock className="size-3 mr-1" />Private</>
                        )}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs font-semibold px-2.5 py-0.5 border-zinc-150/60 dark:border-zinc-800 bg-background/50 rounded-full"
                      >
                        <User className="size-3 mr-1" />
                        {skill.isOwner ? "You" : skill.ownerId?.username || "Community"}
                      </Badge>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                      {skill.name}
                    </h2>

                    <p className="text-sm sm:text-base leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium mt-1">
                      {skill.description || "No description provided."}
                    </p>
                  </div>
                </div>

                <Separator className="my-5" />

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Instructions
                  </h3>
                  <div className="relative">
                    <div className="rounded-2xl border border-zinc-150/60 dark:border-zinc-900 bg-zinc-50/40 dark:bg-zinc-900/10 p-5 font-mono text-xs leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap select-all scrollbar-thin text-zinc-700 dark:text-zinc-300">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {skill.instructions}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Used by Agents Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                  <Boxes className="size-4 text-primary" />
                  Used by Agents
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  Agents that have this skill attached.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usedByAgents.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {usedByAgents.map((agent) => (
                      <Link
                        key={agent._id || agent.id}
                        href={`/dashboard/agents/${agent._id || agent.id}/run`}
                        className="p-3 rounded-2xl border border-zinc-150/60 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-col gap-1.5 transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
                      >
                        <div className="flex items-center gap-2">
                          <div className="rounded bg-muted p-1">
                            <Boxes className="size-4 text-muted-foreground" />
                          </div>
                          <span className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-150">
                            {agent.name}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 px-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/20 dark:bg-zinc-900/5 text-center select-none">
                    <Boxes className="size-8 text-zinc-400 dark:text-zinc-650 mb-3" />
                    <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                      No agents using this skill
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed font-medium">
                      Attach this skill to an agent in the agent builder to enable its capabilities.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Full Instructions Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                    <Brain className="size-4 text-primary" />
                    SKILL.md
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    The core logic and workflow for this skill.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyText}
                  className="h-8 rounded-full px-3.5 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all border border-zinc-150/60 dark:border-zinc-800"
                >
                  {copied ? (
                    <>
                      <Check className="mr-1.5 size-3.5 text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 size-3.5" />
                      Copy
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-pre:bg-muted prose-pre:border prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5 rounded-2xl border border-zinc-150/60 dark:border-zinc-900 bg-zinc-50/40 dark:bg-zinc-900/10 p-5 max-h-96 overflow-y-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {skill.instructions}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar Column (1/3 width) */}
          <div className="space-y-8">
            {/* Quick Actions Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl p-5 space-y-4 ring-0 shadow-none">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Actions</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  Manage this skill configuration.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {isOwner && (
                  <>
                    <Link href={`/dashboard/connectors/skills/${skillId}/edit`}>
                      <Button
                        variant="outline"
                        className="w-full h-10 font-bold text-sm rounded-full border border-zinc-150/60 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all uppercase tracking-wider shadow-none"
                      >
                        <Edit className="mr-2 size-4" />
                        Edit Skill
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="w-full h-10 font-bold text-sm rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 uppercase tracking-wider border border-destructive/20"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete Skill
                    </Button>
                  </>
                )}
              </div>
            </Card>

            {/* Details Metadata Card */}
            <Card className="border border-zinc-150/60 dark:border-zinc-900/60 bg-card rounded-3xl ring-0 shadow-none overflow-hidden">
              <CardHeader className="pb-4 border-b border-zinc-150/60 dark:border-zinc-900/60">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-150">
                  <Sparkles className="size-4 text-primary" />
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-zinc-150/60 dark:divide-zinc-900/60 p-0">
                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                    <Cpu className="size-3.5" />
                    <span>Type</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-150 capitalize text-[10px]">
                    Skill
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                    {skill.isPublic ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                    <span>Visibility</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-150 capitalize">
                    {skill.isPublic ? "Public" : "Private"}
                  </span>
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                    <Boxes className="size-3.5" />
                    <span>Used by</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-150 font-bold">
                    {usedByAgents.length} agent(s)
                  </span>
                </div>

                {skill.createdAt && (
                  <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                      <Calendar className="size-3.5" />
                      <span>Created</span>
                    </div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-150">
                      {new Date(skill.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {skill.updatedAt && (
                  <div className="flex items-center justify-between px-5 py-3.5 text-xs">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
                      <Calendar className="size-3.5" />
                      <span>Updated</span>
                    </div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-150">
                      {new Date(skill.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this skill?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>This action cannot be undone. This will permanently delete <strong>{skill.name}</strong>.</p>
              {usedByAgents.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400 text-xs">
                  <p className="font-bold mb-1">Used by {usedByAgents.length} agents:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {usedByAgents.slice(0, 3).map(a => <li key={a.id || a._id}>{a.name}</li>)}
                    {usedByAgents.length > 3 && <li>...and {usedByAgents.length - 3} others</li>}
                  </ul>
                  <p className="mt-2 text-[10px]">Removing this skill will affect these agents immediately.</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
