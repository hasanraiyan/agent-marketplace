"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Cpu } from "lucide-react";
import { toast } from "sonner";
import { createSkill, updateSkill } from "@/lib/api/skills";

const DEFAULT_FORM = {
  name: "",
  description: "",
  instructions: "",
  isPublic: false,
};

export function SkillDialog({ open, onOpenChange, skill, onSuccess }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (skill) {
      setForm({
        name: skill.name || "",
        description: skill.description || "",
        instructions: skill.instructions || "",
        isPublic: skill.isPublic || false,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [skill, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (skill) {
        await updateSkill(skill.id || skill._id, form);
        toast.success("Skill updated successfully");
      } else {
        await createSkill(form);
        toast.success("Skill created successfully");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save skill");
    } finally {
      setLoading(false);
    }
  };

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="size-5 text-primary" />
              {skill ? "Edit Skill" : "Create New Skill"}
            </DialogTitle>
            <DialogDescription>
              Define specialized instructions and capabilities. Skills use a kebab-case name.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Skill Name (kebab-case)
              </Label>
              <Input
                id="name"
                placeholder="e.g. data-analysis"
                value={form.name}
                onChange={(e) =>
                  update(
                    "name",
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-")
                      .replace(/^-|-$/g, ""),
                  )
                }
                required
                className="bg-muted/20"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="A brief summary of what this skill enables..."
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                required
                rows={2}
                className="bg-muted/20"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="instructions" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Instructions (SKILL.md)
              </Label>
              <Textarea
                id="instructions"
                placeholder="Detail the workflow, rules, and logic for this skill..."
                value={form.instructions}
                onChange={(e) => update("instructions", e.target.value)}
                required
                rows={8}
                className="font-mono text-sm bg-muted/20"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-muted/10 p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold">Public Marketplace</Label>
                <p className="text-xs text-muted-foreground">
                  Allow other users to discover and use this skill.
                </p>
              </div>
              <Switch
                checked={form.isPublic}
                onCheckedChange={(v) => update("isPublic", v)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[100px]">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Save Skill"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
