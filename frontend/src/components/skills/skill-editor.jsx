"use client";

import { useState, useEffect, useRef } from "react";
import { Cpu, Save, X, Info, Check, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createSkill, updateSkill } from "@/lib/api/skills";
import { useRouter } from "next/navigation";
import { useConnectors } from "@/app/dashboard/connectors/connectors-context";
import Link from "next/link";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-markdown";
import "prismjs/themes/prism.css";

const DEFAULT_FORM = {
  name: "",
  description: "",
  instructions: "",
  isPublic: false,
};

export function SkillEditor({ skill, mode = "edit" }) {
  const router = useRouter();
  const { refreshSkills } = useConnectors();
  const [form, setForm] = useState(skill || DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const initialLoad = useRef(true);

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      // Load draft from localStorage if creating new skill
      if (mode === "new") {
        const saved = localStorage.getItem("skill_draft");
        if (saved) {
          try {
            setForm(JSON.parse(saved));
            setIsDirty(true);
          } catch (e) {
            console.error("Failed to load draft");
          }
        }
      }
    }
  }, [mode]);

  useEffect(() => {
    if (isDirty && mode === "new") {
      localStorage.setItem("skill_draft", JSON.stringify(form));
    }
  }, [form, isDirty, mode]);

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleNameChange = (val) => {
    const formatted = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    update("name", formatted);
  };

  const handleSave = async () => {
    if (!form.name || !form.description || !form.instructions) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      let res;
      if (mode === "edit") {
        res = await updateSkill(skill._id || skill.id, form);
        toast.success("Skill updated successfully");
      } else {
        res = await createSkill(form);
        toast.success("Skill created successfully");
        localStorage.removeItem("skill_draft");
      }

      const newSkillId = res.data?.data?._id || res.data?.data?.id;
      setIsDirty(false);
      refreshSkills();
      router.push(`/dashboard/connectors/skills/${newSkillId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save skill");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <Cpu className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{mode === "new" ? "Create Skill" : "Edit Skill"}</h1>
            {isDirty && <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wider animate-pulse">Unsaved Changes</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild disabled={loading}>
            <Link href={mode === "edit" ? `/dashboard/connectors/skills/${skill._id || skill.id}` : "/dashboard/connectors/skills"}>
              <X className="size-4 mr-2" />
              Cancel
            </Link>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading}>
            {loading ? <div className="size-4 border-2 border-primary-foreground border-t-transparent animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            {mode === "new" ? "Create Skill" : "Save Changes"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-10 pb-20">
          {/* Section: General Info - grid layout from agent-form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-1">
              <h2 className="text-sm font-bold">General Information</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose a unique name and descriptive summary for your skill.
              </p>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <Field>
                <FieldLabel className="text-sm font-bold">Skill Name</FieldLabel>
                <Input
                  placeholder="e.g. data-analysis"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="font-mono text-sm bg-muted/20"
                />
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Check className="size-3 text-green-500" />
                  Will be saved as: <code className="bg-muted px-1 rounded">{form.name || "..."}</code>
                </p>
              </Field>

              <Field>
                <FieldLabel className="text-sm font-bold">Description</FieldLabel>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">
                    What does this skill enable the agent to do?
                  </span>
                  <span className={cn("text-[10px] font-medium", form.description.length > 1000 ? "text-destructive" : "text-muted-foreground")}>
                    {form.description.length} / 1024
                  </span>
                </div>
                <Textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value.slice(0, 1024))}
                  rows={3}
                  className="bg-muted/20 resize-none"
                />
              </Field>
            </div>
          </div>

          <hr className="border-muted" />

          {/* Section: Instructions */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
              <Cpu className="size-4" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Instructions (SKILL.md)</h2>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground leading-relaxed">
                The core logic and workflow for this skill using Markdown.
              </p>
              <span className={cn("text-[10px] font-medium", form.instructions.length > 45000 ? "text-destructive" : "text-muted-foreground")}>
                {form.instructions.length.toLocaleString()} / 50,000 chars
              </span>
            </div>

            <div className="rounded-xl border bg-muted/20 focus-within:ring-2 focus-within:ring-primary/20 transition-all min-h-[400px]">
              <Editor
                value={form.instructions}
                onValueChange={(code) => update("instructions", code)}
                highlight={(code) => highlight(code, languages.markdown)}
                padding={20}
                placeholder="# Skill Title\n\n## Overview\n..."
                style={{
                  fontFamily: '"Fira code", "Fira Mono", monospace',
                  fontSize: 14,
                  minHeight: "400px",
                }}
                className="focus:outline-none"
              />
            </div>
          </div>

          <hr className="border-muted" />

          {/* Section: Visibility - from agent-form visibility pattern */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-1">
              <h2 className="text-sm font-bold">Visibility</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Control who can discover and use this skill.
              </p>
            </div>

            <div className="lg:col-span-2">
              <Card className="p-4 flex items-center justify-between bg-muted/10 border-dashed">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <Globe className="size-3.5 text-primary" />
                    Public Marketplace
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                    Enable this to allow other users to discover and import this skill into their agents.
                  </p>
                </div>
                <Switch
                  checked={form.isPublic}
                  onCheckedChange={(checked) => update("isPublic", checked)}
                />
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
