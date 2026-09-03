"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookTextIcon,
  BrainIcon,
  GlobeIcon,
  MessageSquareIcon,
  PlayIcon,
  PlugIcon,
  SparklesIcon,
  UserRoundIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillCover, skillCategoryLabel } from "@/components/skills/skill-cover";
import { getPersonaProfile } from "@/lib/api/skills";
import { getAgentMemory } from "@/lib/api/agents";
import { useThreads } from "@/components/threads-context";
import { cn } from "@/lib/utils";

/**
 * PersonaProfileDialog — the "who am I talking to" panel opened from the
 * composer. Sections: About · Skills · Integrations · Memory · Chats.
 * Read-only; playing a skill navigates to the persona chat with it pinned.
 */

const SECTIONS = [
  { id: "about", label: "About", icon: UserRoundIcon },
  { id: "skills", label: "Skills", icon: SparklesIcon },
  { id: "integrations", label: "Integrations", icon: PlugIcon },
  { id: "memory", label: "Memory", icon: BrainIcon },
  { id: "chats", label: "Chats", icon: MessageSquareIcon },
];

function SocialLink({ href, label }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-400 hover:text-zinc-900"
    >
      {label}
    </a>
  );
}

function Empty({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 px-5 py-8 text-center text-sm font-medium text-zinc-500">
      {children}
    </div>
  );
}

export function PersonaProfileDialog({ agentId, open, onOpenChange, agent }) {
  const [section, setSection] = useState("about");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [memory, setMemory] = useState(null);
  const { groups } = useThreads();

  useEffect(() => {
    if (!open || !agentId) return;
    let cancelled = false;
    Promise.resolve().then(() => !cancelled && setLoading(true));
    getPersonaProfile(agentId)
      .then((res) => !cancelled && setProfile(res.data?.data || null))
      .catch(() => !cancelled && setProfile(null))
      .finally(() => !cancelled && setLoading(false));
    getAgentMemory(agentId)
      .then((res) => !cancelled && setMemory(res.data?.data || []))
      .catch(() => !cancelled && setMemory([]));
    return () => {
      cancelled = true;
    };
  }, [open, agentId]);

  const persona = profile?.persona || agent || {};
  const chats = useMemo(() => {
    const g = (groups || []).find(
      (x) => String(x.agent?._id || x.agent?.id) === String(agentId),
    );
    return g?.threads || [];
  }, [groups, agentId]);

  const socials = persona.socialLinks || {};
  const hasSocials = Object.values(socials).some(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(48rem,calc(100vw-2rem))] max-w-none grid-cols-[minmax(0,1fr)] gap-0 overflow-hidden rounded-[24px] p-0 sm:max-w-none">
        <DialogTitle className="sr-only">{persona.name || "Persona"}</DialogTitle>
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-zinc-100 px-6 py-5">
          <div className="size-14 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/70">
            {persona.avatarUrl || persona.avatar ? (
              <img
                src={persona.avatarUrl || persona.avatar}
                alt=""
                className="size-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold tracking-tight text-zinc-900">
              {persona.name}
            </h2>
            <p className="truncate text-sm text-zinc-500">
              {persona.tagline || persona.description}
            </p>
          </div>
          {profile?.stats ? (
            <div className="hidden shrink-0 items-center gap-4 text-right sm:flex">
              <div>
                <div className="text-lg font-semibold tabular-nums text-zinc-900">
                  {profile.stats.skillCount}
                </div>
                <div className="text-[11px] font-medium text-zinc-500">skills</div>
              </div>
              <div>
                <div className="text-lg font-semibold tabular-nums text-zinc-900">
                  {profile.stats.chats}
                </div>
                <div className="text-[11px] font-medium text-zinc-500">chats</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-[420px] max-h-[70vh] min-w-0">
          {/* Section nav */}
          <nav className="w-44 shrink-0 border-r border-zinc-100 bg-zinc-50/60 p-2">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition-colors cursor-pointer",
                    active
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-500 hover:bg-white/70 hover:text-zinc-900",
                  )}
                >
                  <Icon className={cn("size-4", active ? "text-[#1E60FF]" : "text-zinc-400")} />
                  {s.label}
                </button>
              );
            })}
          </nav>

          {/* Section body */}
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {loading && !profile ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : section === "about" ? (
              <div className="space-y-5">
                <p className="text-[15px] leading-7 text-zinc-800">
                  {persona.bio || persona.description || "No bio yet."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {persona.category ? (
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                      {persona.category}
                    </span>
                  ) : null}
                  {persona.webSearchEnabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                      <GlobeIcon className="size-3" /> Searches the web
                    </span>
                  ) : null}
                </div>
                {hasSocials ? (
                  <div>
                    <div className="mb-2 text-[11px] font-mono uppercase tracking-[0.16em] text-zinc-500">
                      Follow
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SocialLink href={socials.website} label="Website" />
                      <SocialLink href={socials.twitter} label="X" />
                      <SocialLink href={socials.linkedin} label="LinkedIn" />
                      <SocialLink href={socials.github} label="GitHub" />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : section === "skills" ? (
              profile?.skills?.length ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {profile.skills.map((sk) => (
                    <Link
                      key={sk._id}
                      href={`/dashboard/agents/${agentId}/run?skill=${sk._id}&threadId=new`}
                      onClick={() => onOpenChange?.(false)}
                      className="group flex flex-col rounded-2xl p-1.5 -m-1.5 hover:bg-zinc-50"
                    >
                      <div className="relative">
                        <SkillCover
                          skill={sk}
                          persona={persona}
                          className="aspect-square w-full rounded-[16px]"
                          size="sm"
                        />
                        <span className="absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-full bg-[#1E60FF] text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                          <PlayIcon className="size-3.5 fill-current" />
                        </span>
                      </div>
                      <div className="mt-2 text-[13px] font-semibold leading-snug text-zinc-900 line-clamp-2">
                        {sk.title}
                      </div>
                      <div className="text-[11px] font-medium text-zinc-500">
                        {skillCategoryLabel(sk.category)}
                        {sk.usageCount ? ` · ${sk.usageCount} plays` : ""}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty>No published skills yet.</Empty>
              )
            ) : section === "integrations" ? (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em] text-zinc-500">
                    <PlugIcon className="size-3.5" /> Connectors
                  </div>
                  {profile?.integrations?.length ? (
                    <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-100">
                      {profile.integrations.map((m) => (
                        <li key={m._id} className="px-4 py-3">
                          <div className="text-sm font-semibold text-zinc-900">{m.name}</div>
                          {m.description ? (
                            <div className="text-xs text-zinc-500">{m.description}</div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>No external tools connected.</Empty>
                  )}
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em] text-zinc-500">
                    <BookTextIcon className="size-3.5" /> Knowledge
                  </div>
                  {profile?.knowledgeBases?.length ? (
                    <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-100">
                      {profile.knowledgeBases.map((kb) => (
                        <li key={kb._id} className="px-4 py-3">
                          <div className="text-sm font-semibold text-zinc-900">{kb.name}</div>
                          <div className="text-xs text-zinc-500">
                            {kb.documentCount} document{kb.documentCount === 1 ? "" : "s"}
                            {kb.description ? ` · ${kb.description}` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>No knowledge sources attached.</Empty>
                  )}
                </div>
              </div>
            ) : section === "memory" ? (
              memory === null ? (
                <Skeleton className="h-24 w-full" />
              ) : memory.length ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-zinc-500">
                    What {persona.name} remembers about you. Private to you.
                  </p>
                  {memory.map((f) => (
                    <div key={f.path} className="rounded-2xl border border-zinc-100 p-4">
                      <div className="mb-1 font-mono text-[11px] text-zinc-500">{f.path}</div>
                      <pre className="whitespace-pre-wrap font-sans text-[13px] leading-6 text-zinc-800">
                        {f.content}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>Nothing remembered yet. It fills in as you talk.</Empty>
              )
            ) : chats.length ? (
              <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-100">
                {chats.map((t) => (
                  <li key={t._id || t.id}>
                    <Link
                      href={`/dashboard/agents/${agentId}/run?threadId=${t._id || t.id}`}
                      onClick={() => onOpenChange?.(false)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50"
                    >
                      <span className="truncate text-sm font-medium text-zinc-900">
                        {t.title || "New Conversation"}
                      </span>
                      <span className="shrink-0 text-[11px] text-zinc-400">
                        {t.lastMessageAt
                          ? new Date(t.lastMessageAt).toLocaleDateString()
                          : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No chats with {persona.name} yet.</Empty>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
