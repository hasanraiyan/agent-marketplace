"use client";

import { Bot, Lock, X, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, VISIBILITY_OPTIONS } from "./constants";

export function AgentGeneralInfo({
  form,
  update,
  tagsInput,
  setTagsInput,
  addTag,
  removeTag,
}) {
  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
          <Bot className="size-4" />
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Identity
          </h2>
        </div>

        <div className="grid gap-6">
          <Field>
            <FieldLabel className="text-sm font-bold">Agent Name</FieldLabel>
            <Input
              placeholder="e.g. Research Assistant"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="h-11 bg-muted/20"
              required
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <FieldLabel className="text-sm font-bold">Category</FieldLabel>
              <Select
                value={form.category}
                onValueChange={(v) => update("category", v)}
              >
                <SelectTrigger className="h-11 bg-muted/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <c.icon className="mr-2 size-4 text-muted-foreground" />
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel className="text-sm font-bold">Avatar URL</FieldLabel>
              <Input
                type="url"
                placeholder="https://images.com/..."
                value={form.avatar}
                onChange={(e) => update("avatar", e.target.value)}
                className="h-11 bg-muted/20"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel className="text-sm font-bold">Description</FieldLabel>
            <Textarea
              placeholder="Tell us what this agent specializes in..."
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
              className="bg-muted/20"
            />
          </Field>

          <Field>
            <FieldLabel className="text-sm font-bold">Tags</FieldLabel>
            <div className="flex flex-col gap-2">
              <Input
                placeholder="productivity, help, coding..."
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onKeyDown={addTag}
                className="bg-muted/20"
              />
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="pl-2 pr-1 py-1 gap-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-destructive"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </Field>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
          <Lock className="size-4" />
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Visibility
          </h2>
        </div>

        <div className="grid gap-4">
          {VISIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update("visibility", opt.value)}
              className={`flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                form.visibility === opt.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "bg-card hover:bg-muted/50"
              }`}
            >
              <div
                className={`mt-0.5 rounded-lg p-2 ${form.visibility === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                <opt.icon className="size-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{opt.label}</p>
                  {form.visibility === opt.value && (
                    <CheckCircle2 className="size-4 text-primary" />
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground uppercase tracking-tight">
                  {opt.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
