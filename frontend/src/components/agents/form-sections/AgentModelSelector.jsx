"use client";

import Link from "next/link";
import { Cpu, Plug } from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AgentModelSelector({
  form,
  update,
  changeProvider,
  providers,
  loadingProviders,
  models,
  loadingModels,
  noProviders,
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2 border-b pb-2 text-foreground/80">
        <Cpu className="size-4" />
        <h2 className="text-sm font-bold uppercase tracking-wider">
          Capabilities
        </h2>
      </div>

      {noProviders ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <Plug className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1 text-sm">
            <p className="font-bold">No AI provider configured</p>
            <p className="text-muted-foreground">
              Add an LLM provider (API key) before creating an agent.
            </p>
            <Link
              href="/dashboard/settings"
              className="inline-block font-medium text-primary underline-offset-2 hover:underline"
            >
              Go to provider settings
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <FieldLabel className="text-sm font-bold">AI Provider</FieldLabel>
            <Select
              value={form.providerId}
              onValueChange={changeProvider}
              disabled={loadingProviders}
            >
              <SelectTrigger className="h-11 bg-muted/20">
                <SelectValue
                  placeholder={
                    loadingProviders ? "Loading..." : "Select Provider"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id || p._id} value={p.id || p._id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel className="text-sm font-bold">Model</FieldLabel>
            <Select
              value={form.modelName}
              onValueChange={(v) => update("modelName", v)}
              disabled={loadingModels}
            >
              <SelectTrigger className="h-11 bg-muted/20">
                <SelectValue
                  placeholder={loadingModels ? "Loading..." : "Select Model"}
                />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
    </section>
  );
}
