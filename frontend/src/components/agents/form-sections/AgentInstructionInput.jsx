"use client";

import { Brain } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";

export function AgentInstructionInput({ form, update }) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
        <Brain className="size-4" />
        <h2 className="text-sm font-bold uppercase tracking-wider">
          Instructions
        </h2>
      </div>

      <div className="grid gap-6">
        <Field>
          <FieldLabel className="text-sm font-bold">System Prompt</FieldLabel>
          <Textarea
            placeholder="What does this GPT do? How does it behave? What should it avoid doing?"
            value={form.systemPrompt}
            onChange={(e) => update("systemPrompt", e.target.value)}
            rows={12}
            className="font-mono text-sm bg-muted/20"
            required
          />
        </Field>
      </div>
    </section>
  );
}
