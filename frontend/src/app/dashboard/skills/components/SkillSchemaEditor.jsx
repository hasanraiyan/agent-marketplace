"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import SimpleEditor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-markdown";
import "prismjs/themes/prism-tomorrow.css";

export function SkillSchemaEditor({ form, update }) {
  return (
    <div className="grid gap-6 py-6">
      <div className="grid gap-2">
        <Label
          htmlFor="name"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
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
        <Label
          htmlFor="description"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
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
        <Label
          htmlFor="instructions"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          Instructions (SKILL.md)
        </Label>
        <div className="relative min-h-[200px] w-full rounded-md border border-input bg-muted/20 font-mono text-sm focus-within:ring-1 focus-within:ring-ring">
          <SimpleEditor
            value={form.instructions}
            onValueChange={(code) => update("instructions", code)}
            highlight={(code) => highlight(code, languages.markdown, "markdown")}
            padding={16}
            style={{
              fontFamily: '"Fira code", "Fira Mono", monospace',
              fontSize: 14,
              minHeight: "200px",
            }}
            className="outline-none"
          />
        </div>
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
  );
}
