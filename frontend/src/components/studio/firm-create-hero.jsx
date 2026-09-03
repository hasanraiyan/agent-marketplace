"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Building2Icon,
  Loader2Icon,
  RocketIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { createFirm } from "@/lib/api/firms";
import { useFirm } from "@/components/studio/firm-context";
import { FIRM_CATEGORIES } from "@/components/studio/firm-primitives";

const STEPS = [
  {
    icon: Building2Icon,
    title: "Name it",
    text: "A name, a tagline, and the field you work in.",
  },
  {
    icon: UsersIcon,
    title: "Add employees & projects",
    text: "Your agents become the team. Package what they deliver as projects.",
  },
  {
    icon: RocketIcon,
    title: "Publish",
    text: "Your storefront goes live in the marketplace and clients can hire you.",
  },
];

export function FirmCreateHero() {
  const { refresh } = useFirm();
  const [form, setForm] = useState({ name: "", tagline: "", category: "other" });
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (name.length < 2) {
      toast.error("Give your firm a name (at least 2 characters)");
      return;
    }
    setSaving(true);
    try {
      await createFirm({
        name,
        tagline: form.tagline.trim() || undefined,
        category: form.category,
      });
      toast.success("Your firm is open for business");
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create your firm");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-8 pt-2"
      >
        <div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#1E60FF]/10 px-3 py-1 text-[11px] font-bold tracking-wide text-[#1E60FF] uppercase">
            <Building2Icon className="size-3.5" />
            My Firm
          </div>
          <h1 className="font-display text-3xl leading-[1.1] font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Your one-person company, built for you.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed font-medium text-slate-500 dark:text-slate-400">
            Turn your agents into a team, package what they deliver as projects,
            and open a storefront clients can hire from.
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + idx * 0.07 }}
                className="flex items-start gap-4 rounded-2xl border border-slate-150/70 bg-white p-4 dark:border-slate-850/60 dark:bg-slate-950/40"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-650 dark:bg-slate-900 dark:text-slate-350">
                  <Icon className="size-4.5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    <span className="mr-1.5 text-slate-400 tabular-nums dark:text-slate-500">
                      {idx + 1}.
                    </span>
                    {step.title}
                  </div>
                  <div className="text-xs leading-relaxed font-medium text-slate-500 dark:text-slate-400">
                    {step.text}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </motion.div>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex h-fit flex-col gap-5 rounded-2xl border border-slate-150/70 bg-white p-6 shadow-sm dark:border-slate-850/60 dark:bg-slate-950/40"
      >
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Open your firm
          </h2>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            You can change all of this later.
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="firm-name">Firm name</FieldLabel>
          <Input
            id="firm-name"
            value={form.name}
            onChange={set("name")}
            placeholder="Northstar Growth Co."
            maxLength={80}
            autoFocus
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="firm-tagline">Tagline</FieldLabel>
          <Input
            id="firm-tagline"
            value={form.tagline}
            onChange={set("tagline")}
            placeholder="Investor-ready decks for first-time founders"
            maxLength={140}
          />
          <FieldDescription>
            One line that says who you help and with what.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="firm-category">Category</FieldLabel>
          <NativeSelect className="w-full">
            <select
              id="firm-category"
              value={form.category}
              onChange={set("category")}
            >
              {FIRM_CATEGORIES.map((c) => (
                <NativeSelectOption key={c.value} value={c.value}>
                  {c.label}
                </NativeSelectOption>
              ))}
            </select>
          </NativeSelect>
        </Field>

        <Button
          type="submit"
          disabled={saving}
          className="mt-1 h-10 rounded-full font-bold"
        >
          {saving ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <Building2Icon />
          )}
          {saving ? "Opening…" : "Create my firm"}
        </Button>
      </motion.form>
    </div>
  );
}
