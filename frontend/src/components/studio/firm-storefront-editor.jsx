"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2Icon, PlusIcon, SaveIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateMyFirm } from "@/lib/api/firms";
import { useFirm } from "@/components/studio/firm-context";
import { FIRM_CATEGORIES, SectionCard } from "@/components/studio/firm-primitives";
import { TagInput } from "@/components/studio/list-editors";

const idOf = (v) => (v && typeof v === "object" ? v._id : v) || "";

function toForm(firm) {
  return {
    name: firm.name || "",
    tagline: firm.tagline || "",
    bio: firm.bio || "",
    category: firm.category || "other",
    avatar: firm.avatar || "",
    expertise: firm.expertise || [],
    takes: firm.mandate?.takes || [],
    refuses: firm.mandate?.refuses || [],
    clientProfile: firm.mandate?.clientProfile || "",
    proof: (firm.proof || []).map((p) => ({
      quote: p.quote || "",
      author: p.author || "",
      role: p.role || "",
    })),
    frontDeskAgentId: idOf(firm.frontDeskAgentId),
  };
}

/**
 * Everything a visitor sees on the storefront, editable in place.
 * `team` comes from the parent so the front desk picker shares one fetch.
 */
export function FirmStorefrontEditor({ team, onTeamChange }) {
  const { firm, setFirm } = useFirm();
  const [form, setForm] = useState(() => toForm(firm));
  const [saving, setSaving] = useState(false);

  // Re-sync when the firm changes underneath us (publish, front desk from Team).
  useEffect(() => {
    setForm(toForm(firm));
  }, [firm]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(toForm(firm)),
    [form, firm],
  );

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setList = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const updateProof = (idx, key, value) =>
    setForm((f) => ({
      ...f,
      proof: f.proof.map((p, i) => (i === idx ? { ...p, [key]: value } : p)),
    }));

  const members = team.filter((a) => a.isMember);
  const others = team.filter((a) => !a.isMember);

  const save = async () => {
    const name = form.name.trim();
    if (name.length < 2) {
      toast.error("Firm name needs at least 2 characters");
      return;
    }
    setSaving(true);
    try {
      const res = await updateMyFirm({
        name,
        tagline: form.tagline.trim(),
        bio: form.bio,
        category: form.category,
        avatar: form.avatar.trim(),
        expertise: form.expertise,
        mandate: {
          takes: form.takes,
          refuses: form.refuses,
          clientProfile: form.clientProfile,
        },
        proof: form.proof
          .filter((p) => p.quote.trim())
          .map((p) => ({
            quote: p.quote.trim(),
            author: p.author.trim(),
            role: p.role.trim(),
          })),
        frontDeskAgentId: form.frontDeskAgentId || null,
      });
      const frontDeskChanged =
        form.frontDeskAgentId !== idOf(firm.frontDeskAgentId);
      setFirm(res.data?.data || firm);
      toast.success("Storefront saved");
      if (frontDeskChanged) onTeamChange?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save storefront");
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.name || "F").slice(0, 2).toUpperCase();

  return (
    <SectionCard
      id="storefront"
      title="Storefront"
      description="What visitors see when they find your firm in the marketplace."
      action={
        <Button
          size="sm"
          disabled={!dirty || saving}
          onClick={save}
          className="rounded-full px-4 font-bold"
        >
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          Save
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="sf-name">Name</FieldLabel>
          <Input id="sf-name" value={form.name} onChange={set("name")} maxLength={80} />
        </Field>
        <Field>
          <FieldLabel htmlFor="sf-category">Category</FieldLabel>
          <NativeSelect className="w-full">
            <select id="sf-category" value={form.category} onChange={set("category")}>
              {FIRM_CATEGORIES.map((c) => (
                <NativeSelectOption key={c.value} value={c.value}>
                  {c.label}
                </NativeSelectOption>
              ))}
            </select>
          </NativeSelect>
        </Field>
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="sf-tagline">Tagline</FieldLabel>
          <Input
            id="sf-tagline"
            value={form.tagline}
            onChange={set("tagline")}
            placeholder="Investor-ready decks for first-time founders"
            maxLength={140}
          />
          <FieldDescription>Required to publish. {form.tagline.length}/140</FieldDescription>
        </Field>
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="sf-bio">Bio</FieldLabel>
          <Textarea
            id="sf-bio"
            value={form.bio}
            onChange={set("bio")}
            rows={4}
            maxLength={2000}
            placeholder="Who you are, how you work, and why a client should trust your firm."
          />
        </Field>
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="sf-avatar">Avatar URL</FieldLabel>
          <div className="flex items-center gap-3">
            <Avatar size="lg" className="size-12 rounded-xl">
              <AvatarImage src={form.avatar || undefined} alt="" />
              <AvatarFallback className="rounded-xl text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <Input
              id="sf-avatar"
              value={form.avatar}
              onChange={set("avatar")}
              placeholder="https://…/logo.png"
              className="flex-1"
            />
          </div>
        </Field>
        <Field className="md:col-span-2">
          <FieldLabel>Expertise</FieldLabel>
          <TagInput
            value={form.expertise}
            onChange={setList("expertise")}
            placeholder="Type a topic and press Enter — e.g. fundraising"
          />
          <FieldDescription>Short chips shown under your name.</FieldDescription>
        </Field>
      </div>

      <div className="border-t border-slate-150/70 pt-5 dark:border-slate-850/60">
        <h3 className="text-xs font-bold tracking-wider text-slate-450 uppercase dark:text-slate-500">
          Mandate
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel>We take</FieldLabel>
            <TagInput
              value={form.takes}
              onChange={setList("takes")}
              placeholder="Pre-seed founders raising their first round"
              max={20}
            />
          </Field>
          <Field>
            <FieldLabel>We don&apos;t take</FieldLabel>
            <TagInput
              value={form.refuses}
              onChange={setList("refuses")}
              placeholder="Agencies reselling our work"
              max={20}
            />
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="sf-client-profile">Ideal client</FieldLabel>
            <Textarea
              id="sf-client-profile"
              value={form.clientProfile}
              onChange={set("clientProfile")}
              rows={3}
              maxLength={1000}
              placeholder="Describe the person who gets the most out of working with you."
            />
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-150/70 pt-5 dark:border-slate-850/60">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold tracking-wider text-slate-450 uppercase dark:text-slate-500">
            Proof &amp; testimonials
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={form.proof.length >= 20}
            onClick={() =>
              setForm((f) => ({
                ...f,
                proof: [...f.proof, { quote: "", author: "", role: "" }],
              }))
            }
            className="rounded-full font-bold"
          >
            <PlusIcon />
            Add quote
          </Button>
        </div>
        {form.proof.length === 0 ? (
          <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            No quotes yet. A line from a past client goes a long way.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {form.proof.map((p, idx) => (
              <div
                key={idx}
                className="relative grid grid-cols-1 gap-3 rounded-xl border border-slate-150/70 p-3 sm:grid-cols-[1fr_1fr] dark:border-slate-850/60"
              >
                <Textarea
                  value={p.quote}
                  onChange={(e) => updateProof(idx, "quote", e.target.value)}
                  rows={2}
                  maxLength={600}
                  placeholder="“They turned my messy notes into a deck investors actually read.”"
                  className="sm:col-span-2"
                />
                <Input
                  value={p.author}
                  onChange={(e) => updateProof(idx, "author", e.target.value)}
                  placeholder="Author"
                  maxLength={120}
                />
                <Input
                  value={p.role}
                  onChange={(e) => updateProof(idx, "role", e.target.value)}
                  placeholder="Role, e.g. Founder at Acme"
                  maxLength={120}
                />
                <button
                  type="button"
                  aria-label="Remove quote"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      proof: f.proof.filter((_, i) => i !== idx),
                    }))
                  }
                  className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-slate-150 bg-white text-slate-400 shadow-xs hover:text-rose-600 dark:border-slate-800 dark:bg-slate-900"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-150/70 pt-5 dark:border-slate-850/60">
        <Field>
          <FieldLabel htmlFor="sf-front-desk">Front desk employee</FieldLabel>
          <NativeSelect className="w-full max-w-md">
            <select
              id="sf-front-desk"
              value={form.frontDeskAgentId}
              onChange={set("frontDeskAgentId")}
            >
              <NativeSelectOption value="">No front desk yet</NativeSelectOption>
              {members.length ? (
                <NativeSelectOptGroup label="Employees">
                  {members.map((a) => (
                    <NativeSelectOption key={a._id} value={a._id}>
                      {a.name}
                      {a.role?.title ? ` — ${a.role.title}` : ""}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ) : null}
              {others.length ? (
                <NativeSelectOptGroup label="Other agents (joins the firm when chosen)">
                  {others.map((a) => (
                    <NativeSelectOption key={a._id} value={a._id}>
                      {a.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ) : null}
            </select>
          </NativeSelect>
          <FieldDescription>
            The employee who greets visitors and routes them to the right project.
            Required to publish.
          </FieldDescription>
        </Field>
      </div>
    </SectionCard>
  );
}
