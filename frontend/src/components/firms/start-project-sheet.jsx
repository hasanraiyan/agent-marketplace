"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { startFirmProject } from "@/lib/api/firms";
import { personaRoutes } from "@/lib/studio-routes";
import { cn } from "@/lib/utils";
import { apiError, formatDuration, formatPrice } from "./utils";

function isUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Onboarding form generated from `project.inputs`. On success the client is
 * dropped straight into the new project workspace.
 */
export function StartProjectSheet({
  open,
  onOpenChange,
  firmSlug,
  project,
  firmName,
}) {
  const router = useRouter();
  const inputs = useMemo(() => project?.inputs || [], [project]);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setErrors({});
    }
  }, [open]);

  const setValue = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const next = {};
    for (const field of inputs) {
      const v = (values[field.key] || "").trim();
      if (field.required && !v) next[field.key] = "This is required";
      else if (v && field.type === "url" && !isUrl(v))
        next[field.key] = "Enter a full link starting with http:// or https://";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {};
      for (const field of inputs) {
        const v = (values[field.key] || "").trim();
        if (v) payload[field.key] = v;
      }
      const res = await startFirmProject(firmSlug, project.slug, {
        inputs: payload,
      });
      const created = res.data?.data?.project;
      const id = created?._id || created?.id;
      toast.success("Project started", {
        description: `${firmName || "The firm"} is on it.`,
      });
      onOpenChange(false);
      if (id) router.push(personaRoutes.project(id));
      else router.push(personaRoutes.projects);
    } catch (err) {
      const details = err.response?.data?.details;
      if (err.response?.status === 400 && Array.isArray(details)) {
        const next = {};
        for (const d of details) {
          const key = typeof d === "string" ? d : d?.key || d?.field || d?.path;
          const msg =
            typeof d === "string"
              ? "This is required"
              : d?.message || "This is required";
          if (key) next[key] = msg;
        }
        setErrors(next);
        const labels = Object.keys(next)
          .map((k) => inputs.find((f) => f.key === k)?.label || k)
          .join(", ");
        toast.error(
          labels ? `Missing: ${labels}` : apiError(err, "Check the form"),
        );
      } else {
        toast.error(apiError(err, "Could not start the project"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const duration = formatDuration(project?.durationDays);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-zinc-100 bg-white p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-zinc-100 px-6 pt-6 pb-5">
          <p className="font-mono text-[10px] tracking-[0.18em] text-[#1E60FF] uppercase">
            Before we start
          </p>
          <SheetTitle className="font-display mt-1 text-xl font-semibold tracking-tight text-zinc-900">
            {project?.title}
          </SheetTitle>
          <SheetDescription className="text-[13px] font-medium text-zinc-500">
            {inputs.length > 0
              ? "A few things the team needs from you to begin."
              : "Nothing to fill in — the team can begin right away."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-5">
              {inputs.map((field) => {
                const error = errors[field.key];
                const common = {
                  id: `input-${field.key}`,
                  value: values[field.key] || "",
                  onChange: (e) => setValue(field.key, e.target.value),
                  placeholder: field.placeholder || "",
                  disabled: submitting,
                  "aria-invalid": !!error,
                };
                return (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <Label
                      htmlFor={common.id}
                      className="text-[13px] font-semibold text-zinc-800"
                    >
                      {field.label}
                      {field.required ? (
                        <span className="text-[#1E60FF]"> *</span>
                      ) : (
                        <span className="ml-1 text-[11px] font-medium text-zinc-400">
                          optional
                        </span>
                      )}
                    </Label>
                    {field.type === "textarea" ? (
                      <Textarea
                        {...common}
                        rows={4}
                        className="min-h-24 rounded-xl border-zinc-200 text-[13px] focus-visible:border-[#1E60FF] focus-visible:ring-[#1E60FF]/15"
                      />
                    ) : (
                      <Input
                        {...common}
                        type={field.type === "url" ? "url" : "text"}
                        inputMode={field.type === "url" ? "url" : "text"}
                        className="h-10 rounded-xl border-zinc-200 text-[13px] focus-visible:border-[#1E60FF] focus-visible:ring-[#1E60FF]/15"
                      />
                    )}
                    {error && (
                      <p className="text-[11px] font-semibold text-red-500">
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-zinc-100 bg-zinc-50/60 px-6 py-4">
            <div className="mb-3 flex items-center justify-between text-[12px] font-medium text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-[#1E60FF]" />
                {duration ? `Delivered in ${duration}` : "Delivered by the firm"}
              </span>
              <span className="font-display text-base font-semibold text-zinc-900 tabular-nums">
                {formatPrice(project?.price)}
              </span>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1E60FF] px-5 py-3 text-[13px] font-bold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:bg-[#154ed0] active:scale-98 disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Start this project
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
