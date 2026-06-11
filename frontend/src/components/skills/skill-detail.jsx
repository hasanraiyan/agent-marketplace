"use client";

import { useState, useEffect } from "react";
import { Cpu, Globe, Lock, Edit, Trash2, Calendar, User, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { deleteSkill, getUsedByAgents } from "@/lib/api/skills";
import { useRouter } from "next/navigation";
import { useSkills } from "@/app/dashboard/skills/skills-context";
import Link from "next/link";

export function SkillDetail({ skill }) {
  const router = useRouter();
  const { refreshSkills, mySkills } = useSkills();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [usedByAgents, setUsedByAgents] = useState([]);

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
      router.push("/dashboard/skills");
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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <Cpu className="size-5" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-xl font-bold truncate">{skill.name}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Badge variant={skill.isPublic ? "default" : "outline"} className="text-[10px] uppercase h-4 px-1.5 py-0">
                {skill.isPublic ? <Globe className="size-2.5 mr-1" /> : <Lock className="size-2.5 mr-1" />}
                {skill.isPublic ? "Public" : "Private"}
              </Badge>
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                Updated {new Date(skill.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/skills/${skill._id || skill.id}/edit`}>
                <Edit className="size-4 mr-2" />
                Edit
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="size-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-8">
          {/* Description */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">{skill.description}</p>
          </section>

          {/* Instructions */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Instructions (SKILL.md)</h2>
            <div className="rounded-xl border bg-muted/30 p-6 overflow-hidden">
              <article className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-pre:bg-muted prose-pre:border prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {skill.instructions}
                </ReactMarkdown>
              </article>
            </div>
          </section>

          {/* Used by Agents */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Used by Agents</h2>
              <Badge variant="secondary" className="rounded-full text-[10px] h-4 px-1.5">
                {usedByAgents.length}
              </Badge>
            </div>
            {usedByAgents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {usedByAgents.map(agent => (
                  <Link key={agent._id || agent.id} href={`/dashboard/agents/${agent._id || agent.id}`} className="group p-3 rounded-lg border bg-card hover:border-primary/30 transition-all flex items-center gap-3">
                    <div className="rounded bg-muted p-1 group-hover:bg-primary/10 transition-colors">
                      <Boxes className="size-4 group-hover:text-primary" />
                    </div>
                    <span className="text-sm font-medium truncate">{agent.name}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-xl border border-dashed text-center flex flex-col items-center justify-center bg-muted/10">
                <Boxes className="size-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground italic">No agents are currently using this skill</p>
              </div>
            )}
          </section>
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
