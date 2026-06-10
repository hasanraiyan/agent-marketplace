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
import { Loader2, Cpu } from "lucide-react";
import { toast } from "sonner";
import { createSkill, updateSkill } from "@/lib/api/skills";
import { SkillSchemaEditor } from "@/app/dashboard/skills/components/SkillSchemaEditor";

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

          <SkillSchemaEditor form={form} update={update} />

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
