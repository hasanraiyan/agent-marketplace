"use client";

import Link from "next/link";
import { Cpu, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FieldLabel, FieldDescription } from "@/components/ui/field";

export function AgentToolsSelector({
  form,
  update,
  availableSkills,
  loadingSkills,
  toggleSkill,
}) {
  return (
    <div className="space-y-10">
      {/* Section: Skills */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
          <Cpu className="size-4" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Skills</h2>
        </div>

        <div className="grid gap-4">
          <FieldDescription className="text-xs -mt-2">
            Attach specialized capabilities to this agent. Skills provide
            additional instructions and context.
          </FieldDescription>

          {loadingSkills ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading skills...
            </div>
          ) : availableSkills.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No skills created yet.
              </p>
              <Link href="/dashboard/skills">
                <Button variant="outline" size="sm">
                  Create a Skill
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {availableSkills.map((skill) => {
                const isSelected = (form.skills || []).includes(
                  skill.id || skill._id,
                );
                return (
                  <button
                    key={skill.id || skill._id}
                    type="button"
                    onClick={() => toggleSkill(skill.id || skill._id)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold truncate">
                          {skill.name}
                        </p>
                        {isSelected && (
                          <Check className="size-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                        {skill.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Section: Intelligence - Web Search */}
      <section className="space-y-6">
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <FieldLabel className="flex items-center gap-2 font-bold">
                Web Search
              </FieldLabel>
              <FieldDescription>
                Allow the agent to search the web.
              </FieldDescription>
            </div>
            <Switch
              checked={form.webSearchEnabled}
              onCheckedChange={(v) => update("webSearchEnabled", v)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
