"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  Loader2Icon,
  PlusIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createFirmProjectTemplate,
  updateFirmProjectTemplate,
} from "@/lib/api/firms";
import { getMySkills } from "@/lib/api/skills";
import { studioRoutes } from "@/lib/studio-routes";
import { cn } from "@/lib/utils";
import { useFirmTeam } from "@/components/studio/use-firm-team";
import { AgentAvatar, SectionCard } from "@/components/studio/firm-primitives";
import { StringListEditor } from "@/components/studio/list-editors";

const idOf = (v) => (v && typeof v === "object" ? v._id : v) || "";
const idsOf = (list) => (list || []).map(idOf).filter(Boolean);

const slugKey = (label) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const EMPTY_DELIVERABLE = { name: "", acceptanceCriteria: "" };
const EMPTY_INPUT = {
  key: "",
  label: "",
  type: "text",
  required: true,
  placeholder: "",
  keyTouched: false,
};

function toForm(project) {
  return {
    title: project?.title || "",
    outcome: project?.outcome || "",
    summary: project?.summary || "",
    description: project?.description || "",
    whoFor: project?.whoFor || [],
    deliverables: project?.deliverables?.length
      ? project.deliverables.map((d) => ({
          name: d.name || "",
          acceptanceCriteria: d.acceptanceCriteria || "",
        }))
      : [{ ...EMPTY_DELIVERABLE }],
    durationDays: project?.durationDays ? String(project.durationDays) : "",
    price: {
      amount:
        project?.price?.amount !== undefined && project?.price?.amount !== null
          ? String(project.price.amount)
          : "",
      currency: project?.price?.currency || "USD",
      period: project?.price?.period || "one-time",
    },
    inputs: (project?.inputs || []).map((i) => ({
      key: i.key || "",
      label: i.label || "",
      type: i.type || "text",
      required: i.required !== false,
      placeholder: i.placeholder || "",
      keyTouched: true,
    })),
    checkpoints: project?.checkpoints || [],
    leadAgentId: idOf(project?.leadAgentId),
    employeeIds: idsOf(project?.employeeIds),
    skillIds: idsOf(project?.skillIds),
    instructions: project?.instructions || "",
    status: project?.status || "draft",
  };
}

function validate(form) {
  if (form.title.trim().length < 3) return "Title needs at least 3 characters";
  if (form.outcome.trim().length < 3) return "Describe the outcome (at least 3 characters)";
  if (!form.deliverables.some((d) => d.name.trim())) return "Add at least one deliverable";
  if (!form.leadAgentId) return "Pick a lead employee to run this project";
  if (form.durationDays !== "") {
    const n = Number(form.durationDays);
    if (!Number.isInteger(n) || n < 1 || n > 365) return "Duration must be 1–365 days";
  }
  if (form.price.amount !== "" && Number(form.price.amount) < 0) return "Price can't be negative";
  for (const input of form.inputs) {
    if (!input.label.trim()) return "Every client input needs a label";
    if (!/^[a-zA-Z0-9_]+$/.test(input.key)) return `Input key “${input.key || "(empty)"}” must be letters, numbers, or _`;
  }
  const keys = form.inputs.map((i) => i.key);
  if (new Set(keys).size !== keys.length) return "Input keys must be unique";
  return null;
}

function toPayload(form) {
  return {
    title: form.title.trim(),
    outcome: form.outcome.trim(),
    summary: form.summary.trim(),
    description: form.description,
    whoFor: form.whoFor.map((s) => s.trim()).filter(Boolean),
    deliverables: form.deliverables
      .filter((d) => d.name.trim())
      .map((d) => ({
        name: d.name.trim(),
        acceptanceCriteria: d.acceptanceCriteria.trim(),
      })),
    durationDays: form.durationDays === "" ? undefined : Number(form.durationDays),
    price: {
      amount: form.price.amount === "" ? 0 : Number(form.price.amount),
      currency: form.price.currency.trim().toUpperCase() || "USD",
      period: form.price.period,
    },
    inputs: form.inputs.map((i) => ({
      key: i.key,
      label: i.label.trim(),
      type: i.type,
      required: Boolean(i.required),
      placeholder: i.placeholder.trim(),
    })),
    checkpoints: form.checkpoints.map((s) => s.trim()).filter(Boolean),
    leadAgentId: form.leadAgentId,
    employeeIds: form.employeeIds,
    skillIds: form.skillIds,
    instructions: form.instructions,
    status: form.status,
  };
}

/** Toggleable chip used for the multi-selects. */
function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-all",
        active
          ? "border-[#1E60FF] bg-[#1E60FF]/10 text-[#1E60FF]"
          : "border-slate-150 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-100",
      )}
    >
      {active ? <CheckIcon className="size-3.5" /> : null}
      {children}
    </button>
  );
}

export function FirmProjectForm({ project = null, mode = "new" }) {
  const router = useRouter();
  const { team, loading: loadingTeam } = useFirmTeam();
  const [skills, setSkills] = useState([]);
  const [form, setForm] = useState(() => toForm(project));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMySkills()
      .then((res) => {
        if (!cancelled) setSkills(res.data?.data || []);
      })
      .catch(() => {
        if (!cancelled) setSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const members = team.filter((a) => a.isMember);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setPrice = (key) => (e) =>
    setForm((f) => ({ ...f, price: { ...f.price, [key]: e.target.value } }));

  const updateRow = (listKey, idx, patch) =>
    setForm((f) => ({
      ...f,
      [listKey]: f[listKey].map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));
  const removeRow = (listKey, idx) =>
    setForm((f) => ({ ...f, [listKey]: f[listKey].filter((_, i) => i !== idx) }));
  const addRow = (listKey, blank) =>
    setForm((f) => ({ ...f, [listKey]: [...f[listKey], { ...blank }] }));
  const moveRow = (listKey, idx, dir) =>
    setForm((f) => {
      const to = idx + dir;
      if (to < 0 || to >= f[listKey].length) return f;
      const next = [...f[listKey]];
      [next[idx], next[to]] = [next[to], next[idx]];
      return { ...f, [listKey]: next };
    });

  const toggleId = (listKey, id) =>
    setForm((f) => ({
      ...f,
      [listKey]: f[listKey].includes(id)
        ? f[listKey].filter((x) => x !== id)
        : [...f[listKey], id],
    }));

  const submit = async (e) => {
    e.preventDefault();
    const error = validate(form);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (mode === "edit" && project?._id) {
        await updateFirmProjectTemplate(project._id, payload);
        toast.success("Project saved");
      } else {
        await createFirmProjectTemplate(payload);
        toast.success("Project created");
      }
      router.push(studioRoutes.firmProjects);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <SectionCard
        title="Basics"
        description="The promise on the storefront card."
      >
        <div className="grid grid-cols-1 gap-5">
          <Field>
            <FieldLabel htmlFor="pj-title">Title</FieldLabel>
            <Input
              id="pj-title"
              value={form.title}
              onChange={set("title")}
              placeholder="Seed Round Deck Sprint"
              maxLength={120}
              autoFocus={mode === "new"}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pj-outcome">Outcome</FieldLabel>
            <Input
              id="pj-outcome"
              value={form.outcome}
              onChange={set("outcome")}
              maxLength={240}
              placeholder="Investor-ready deck and 75-name target list in 4 weeks"
            />
            <FieldDescription>
              Name the artifact and the date, e.g. &ldquo;Investor-ready deck and
              75-name target list in 4 weeks&rdquo;
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="pj-summary">Summary</FieldLabel>
            <Textarea
              id="pj-summary"
              value={form.summary}
              onChange={set("summary")}
              rows={2}
              maxLength={400}
              placeholder="Two sentences a client reads before deciding to look closer."
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pj-description">Description</FieldLabel>
            <Textarea
              id="pj-description"
              value={form.description}
              onChange={set("description")}
              rows={8}
              maxLength={8000}
              className="font-mono text-xs"
              placeholder={"## How it works\n\n1. You share your notes and numbers\n2. We draft, you react, we refine\n3. You walk away with…"}
            />
            <FieldDescription>Markdown is supported — headings, lists, and bold.</FieldDescription>
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Who it's for"
        description="Situations that make a visitor think “that's me”. Each starts with “Are you…”."
      >
        <StringListEditor
          value={form.whoFor}
          onChange={(v) => setField("whoFor", v)}
          placeholder="…raising your first round with no deck yet?"
          addLabel="Add situation"
        />
      </SectionCard>

      <SectionCard
        title="Deliverables"
        description="What the client receives. Acceptance criteria are how the lead knows each one is done."
      >
        <div className="flex flex-col gap-3">
          {form.deliverables.map((d, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-slate-150/70 p-3 dark:border-slate-850/60"
            >
              <div className="flex flex-col gap-2">
                <Input
                  value={d.name}
                  onChange={(e) => updateRow("deliverables", idx, { name: e.target.value })}
                  placeholder={`Deliverable ${idx + 1} — e.g. 12-slide investor deck (PDF + editable)`}
                  maxLength={200}
                />
                <Textarea
                  value={d.acceptanceCriteria}
                  onChange={(e) =>
                    updateRow("deliverables", idx, { acceptanceCriteria: e.target.value })
                  }
                  rows={2}
                  maxLength={1000}
                  placeholder="Accepted when… (e.g. every slide has a headline the client signed off on)"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={idx === 0}
                  onClick={() => moveRow("deliverables", idx, -1)}
                  aria-label="Move up"
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={idx === form.deliverables.length - 1}
                  onClick={() => moveRow("deliverables", idx, 1)}
                  aria-label="Move down"
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={form.deliverables.length === 1}
                  onClick={() => removeRow("deliverables", idx)}
                  aria-label="Remove deliverable"
                  className="text-slate-400 hover:text-rose-600"
                >
                  <XIcon />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={form.deliverables.length >= 30}
            onClick={() => addRow("deliverables", EMPTY_DELIVERABLE)}
            className="w-fit rounded-full font-bold"
          >
            <PlusIcon />
            Add deliverable
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Scope & price">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="pj-duration">Duration (days)</FieldLabel>
            <Input
              id="pj-duration"
              type="number"
              min={1}
              max={365}
              value={form.durationDays}
              onChange={set("durationDays")}
              placeholder="28"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pj-amount">Price</FieldLabel>
            <Input
              id="pj-amount"
              type="number"
              min={0}
              step="1"
              value={form.price.amount}
              onChange={setPrice("amount")}
              placeholder="0"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pj-currency">Currency</FieldLabel>
            <Input
              id="pj-currency"
              value={form.price.currency}
              onChange={setPrice("currency")}
              maxLength={8}
              className="uppercase"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pj-period">Billing</FieldLabel>
            <NativeSelect className="w-full">
              <select id="pj-period" value={form.price.period} onChange={setPrice("period")}>
                <NativeSelectOption value="one-time">One-time</NativeSelectOption>
                <NativeSelectOption value="monthly">Monthly</NativeSelectOption>
              </select>
            </NativeSelect>
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="What you need from the client"
        description="Asked when they start the project. Answers land in the lead employee's brief."
      >
        <div className="flex flex-col gap-3">
          {form.inputs.length === 0 ? (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              No inputs yet — the client just presses start.
            </p>
          ) : null}
          {form.inputs.map((input, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 gap-2 rounded-xl border border-slate-150/70 p-3 sm:grid-cols-[1fr_140px_120px_auto] dark:border-slate-850/60"
            >
              <Input
                value={input.label}
                onChange={(e) => {
                  const label = e.target.value;
                  updateRow("inputs", idx, {
                    label,
                    ...(input.keyTouched ? {} : { key: slugKey(label) }),
                  });
                }}
                placeholder="Label — e.g. Link to your current deck"
                maxLength={120}
              />
              <Input
                value={input.key}
                onChange={(e) =>
                  updateRow("inputs", idx, {
                    key: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                    keyTouched: true,
                  })
                }
                placeholder="key"
                className="font-mono text-xs"
              />
              <NativeSelect className="w-full">
                <select
                  value={input.type}
                  onChange={(e) => updateRow("inputs", idx, { type: e.target.value })}
                  aria-label="Input type"
                >
                  <NativeSelectOption value="text">Short text</NativeSelectOption>
                  <NativeSelectOption value="textarea">Long text</NativeSelectOption>
                  <NativeSelectOption value="url">URL</NativeSelectOption>
                </select>
              </NativeSelect>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Required
                  <Switch
                    checked={input.required}
                    onCheckedChange={(v) => updateRow("inputs", idx, { required: v })}
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow("inputs", idx)}
                  aria-label="Remove input"
                  className="text-slate-400 hover:text-rose-600"
                >
                  <XIcon />
                </Button>
              </div>
              <Input
                value={input.placeholder}
                onChange={(e) => updateRow("inputs", idx, { placeholder: e.target.value })}
                placeholder="Placeholder shown in the empty box (optional)"
                maxLength={200}
                className="sm:col-span-4"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={form.inputs.length >= 20}
            onClick={() => addRow("inputs", EMPTY_INPUT)}
            className="w-fit rounded-full font-bold"
          >
            <PlusIcon />
            Add input
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Checkpoints"
        description="Where you personally step in — shown to clients so they know when to expect you."
      >
        <StringListEditor
          value={form.checkpoints}
          onChange={(v) => setField("checkpoints", v)}
          placeholder="Day 7: I review the narrative before design starts"
          addLabel="Add checkpoint"
        />
      </SectionCard>

      <SectionCard
        title="Team"
        description="The lead runs the project and talks to the client. Other employees are delegated to."
      >
        <Field>
          <FieldLabel htmlFor="pj-lead">Lead employee</FieldLabel>
          {loadingTeam ? (
            <Skeleton className="h-8 w-full max-w-md rounded-lg" />
          ) : (
            <NativeSelect className="w-full max-w-md">
              <select id="pj-lead" value={form.leadAgentId} onChange={set("leadAgentId")}>
                <NativeSelectOption value="">Choose a lead…</NativeSelectOption>
                {members.map((a) => (
                  <NativeSelectOption key={a._id} value={a._id}>
                    {a.name}
                    {a.role?.title ? ` — ${a.role.title}` : ""}
                  </NativeSelectOption>
                ))}
              </select>
            </NativeSelect>
          )}
          {!loadingTeam && members.length === 0 ? (
            <FieldDescription>
              No employees yet — mark an agent as an employee on the Team tab first.
            </FieldDescription>
          ) : null}
        </Field>

        <Field>
          <FieldLabel>Supporting employees</FieldLabel>
          {members.filter((a) => a._id !== form.leadAgentId).length === 0 ? (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Add more employees to delegate parts of the work.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {members
                .filter((a) => a._id !== form.leadAgentId)
                .map((a) => (
                  <Chip
                    key={a._id}
                    active={form.employeeIds.includes(a._id)}
                    onClick={() => toggleId("employeeIds", a._id)}
                  >
                    <AgentAvatar agent={a} className="size-5 rounded-md" />
                    {a.name}
                  </Chip>
                ))}
            </div>
          )}
        </Field>

        <Field>
          <FieldLabel>Skills</FieldLabel>
          {skills.length === 0 ? (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              No skills in your library yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => {
                const id = s._id || s.id;
                return (
                  <Chip
                    key={id}
                    active={form.skillIds.includes(id)}
                    onClick={() => toggleId("skillIds", id)}
                  >
                    {s.name}
                  </Chip>
                );
              })}
            </div>
          )}
          <FieldDescription>Attached to the lead for the duration of the project.</FieldDescription>
        </Field>
      </SectionCard>

      <SectionCard
        title="Playbook"
        description="Never shown to clients. How the lead should run this project, step by step."
      >
        <Textarea
          value={form.instructions}
          onChange={set("instructions")}
          rows={12}
          maxLength={20000}
          className="font-mono text-xs"
          placeholder={"Week 1: Read the client's inputs. Draft the narrative outline and post it as a deliverable note.\nWeek 2: …\nAsk the client (inbox) whenever numbers are missing — never invent them."}
        />
      </SectionCard>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-150/70 bg-white/90 px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-850/60 dark:bg-slate-950/90">
        <Field orientation="horizontal" className="w-auto gap-3">
          <FieldLabel htmlFor="pj-status" className="text-xs">Status</FieldLabel>
          <NativeSelect>
            <select id="pj-status" value={form.status} onChange={set("status")}>
              <NativeSelectOption value="draft">Draft</NativeSelectOption>
              <NativeSelectOption value="published">Published</NativeSelectOption>
            </select>
          </NativeSelect>
        </Field>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full font-bold"
            onClick={() => router.push(studioRoutes.firmProjects)}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving} className="rounded-full px-5 font-bold">
            {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            {mode === "edit" ? "Save project" : "Create project"}
          </Button>
        </div>
      </div>
    </form>
  );
}
