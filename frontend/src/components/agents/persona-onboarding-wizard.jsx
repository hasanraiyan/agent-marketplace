"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Check,
  Loader2,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { updateAgent } from "@/lib/api/agents";
import { cn } from "@/lib/utils";

const TRAIT_PRESETS = [
  "Witty",
  "Warm",
  "Formal",
  "Analytical",
  "Playful",
  "Direct",
  "Empathetic",
  "Curious",
  "Bold",
  "Calm",
];

const MAX_TRAITS = 5;

const STEPS = ["tagline", "bio", "traits", "links"];

/**
 * @param {string} doneHref  where to land once the wizard finishes or is
 *   skipped. Defaults to the dashboard agent page; Studio points it at the
 *   agent's creator workspace.
 */
export function PersonaOnboardingWizard({
  agentId,
  agentName,
  doneHref = `/dashboard/agents/${agentId}`,
}) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [customTrait, setCustomTrait] = useState("");
  const [form, setForm] = useState({
    tagline: "",
    bio: "",
    personalityTraits: [],
    socialLinks: { website: "", twitter: "", github: "", linkedin: "" },
  });

  const step = STEPS[stepIndex];
  const total = STEPS.length;

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleTrait = (trait) => {
    setForm((prev) => {
      const has = prev.personalityTraits.includes(trait);
      if (has) {
        return {
          ...prev,
          personalityTraits: prev.personalityTraits.filter((t) => t !== trait),
        };
      }
      if (prev.personalityTraits.length >= MAX_TRAITS) return prev;
      return { ...prev, personalityTraits: [...prev.personalityTraits, trait] };
    });
  };

  const addCustomTrait = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const trait = customTrait.trim();
    if (!trait) return;
    setForm((prev) => {
      if (prev.personalityTraits.includes(trait) || prev.personalityTraits.length >= MAX_TRAITS) {
        return prev;
      }
      return { ...prev, personalityTraits: [...prev.personalityTraits, trait] };
    });
    setCustomTrait("");
  };

  const updateSocialLink = (platform, value) =>
    update("socialLinks", { ...form.socialLinks, [platform]: value });

  const finish = async (data) => {
    setSaving(true);
    try {
      const payload = { ...form, ...data };
      const hasSocialLinks = Object.values(payload.socialLinks).some(Boolean);
      await updateAgent(agentId, {
        ...(payload.tagline ? { tagline: payload.tagline } : {}),
        ...(payload.bio ? { bio: payload.bio } : {}),
        ...(payload.personalityTraits.length
          ? { personalityTraits: payload.personalityTraits }
          : {}),
        ...(hasSocialLinks ? { socialLinks: payload.socialLinks } : {}),
      });
      toast.success("Persona is ready");
    } catch (err) {
      console.error("Failed to save persona profile:", err);
      toast.error(err.response?.data?.message || "Failed to save your profile");
    } finally {
      router.push(doneHref);
    }
  };

  const goNext = () => {
    if (stepIndex < total - 1) {
      setStepIndex((i) => i + 1);
    } else {
      finish({});
    }
  };

  const skipStep = () => goNext();
  const skipAll = () => finish({});

  return (
    <div className="flex flex-1 min-h-0 items-center justify-center overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            Give {agentName || "your persona"} a personality
          </div>
          <button
            type="button"
            onClick={skipAll}
            disabled={saving}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <SkipForward className="size-3.5" />
            Skip for now
          </button>
        </div>

        <div className="space-y-1.5">
          <Progress value={((stepIndex + 1) / total) * 100} />
          <p className="text-xs font-medium text-muted-foreground">
            Step {stepIndex + 1} of {total}
          </p>
        </div>

        <Card className="rounded-3xl border-zinc-150/60 shadow-none dark:border-zinc-900/60">
          <CardContent className="space-y-5 p-6">
            {step === "tagline" && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold">
                  What&apos;s a one-line hook for this persona?
                </h2>
                <Input
                  autoFocus
                  placeholder="e.g. Your witty coding co-pilot"
                  value={form.tagline}
                  maxLength={150}
                  onChange={(e) => update("tagline", e.target.value)}
                  className="h-11"
                />
              </div>
            )}

            {step === "bio" && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold">
                  Give it a short bio
                </h2>
                <Textarea
                  autoFocus
                  placeholder="Tell people who this persona is..."
                  value={form.bio}
                  maxLength={1000}
                  onChange={(e) => update("bio", e.target.value)}
                  rows={5}
                />
              </div>
            )}

            {step === "traits" && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold">
                  Pick up to {MAX_TRAITS} personality traits
                </h2>
                <div className="flex flex-wrap gap-2">
                  {TRAIT_PRESETS.map((trait) => {
                    const selected = form.personalityTraits.includes(trait);
                    return (
                      <button
                        key={trait}
                        type="button"
                        onClick={() => toggleTrait(trait)}
                        disabled={!selected && form.personalityTraits.length >= MAX_TRAITS}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-zinc-150/60 bg-card hover:bg-muted/50 dark:border-zinc-800",
                        )}
                      >
                        {selected && <Check className="size-3.5" />}
                        {trait}
                      </button>
                    );
                  })}
                </div>
                <Input
                  placeholder="Something else... (press Enter)"
                  value={customTrait}
                  onChange={(e) => setCustomTrait(e.target.value)}
                  onKeyDown={addCustomTrait}
                  disabled={form.personalityTraits.length >= MAX_TRAITS}
                  className="h-10"
                />
              </div>
            )}

            {step === "links" && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold">Any social links?</h2>
                <div className="grid gap-3">
                  <Input
                    type="url"
                    placeholder="Website (https://...)"
                    value={form.socialLinks.website}
                    onChange={(e) => updateSocialLink("website", e.target.value)}
                  />
                  <Input
                    type="url"
                    placeholder="X / Twitter (https://...)"
                    value={form.socialLinks.twitter}
                    onChange={(e) => updateSocialLink("twitter", e.target.value)}
                  />
                  <Input
                    type="url"
                    placeholder="GitHub (https://...)"
                    value={form.socialLinks.github}
                    onChange={(e) => updateSocialLink("github", e.target.value)}
                  />
                  <Input
                    type="url"
                    placeholder="LinkedIn (https://...)"
                    value={form.socialLinks.linkedin}
                    onChange={(e) => updateSocialLink("linkedin", e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={skipStep}
                disabled={saving}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Skip this question
              </button>
              <Button
                onClick={goNext}
                disabled={saving}
                className="rounded-full px-5 font-bold"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : stepIndex < total - 1 ? (
                  <>
                    Continue
                    <ArrowRight className="ml-1.5 size-4" />
                  </>
                ) : (
                  <>
                    Finish
                    <Bot className="ml-1.5 size-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
