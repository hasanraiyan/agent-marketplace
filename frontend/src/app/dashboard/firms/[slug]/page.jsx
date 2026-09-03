"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Bot,
  Check,
  MessageSquare,
  Quote,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { getFirmStorefront } from "@/lib/api/firms";
import { getProfile } from "@/lib/api/profile";
import { personaRoutes, studioRoutes } from "@/lib/studio-routes";
import {
  FirmAvatar,
  ProjectCard,
  apiError,
  categoryLabel,
  idOf,
} from "@/components/firms";

function SectionLabel({ children }) {
  return (
    <p className="mb-3 font-mono text-[10px] tracking-[0.18em] text-zinc-400 uppercase">
      {children}
    </p>
  );
}

function Testimonials({ proof }) {
  const [index, setIndex] = useState(0);
  if (!proof?.length) return null;
  const item = proof[index];
  return (
    <div>
      <SectionLabel>What clients say</SectionLabel>
      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
        <Quote className="size-4 text-[#1E60FF]" />
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-[13px] leading-relaxed text-zinc-700"
        >
          {item.quote}
        </motion.p>
        <p className="mt-3 text-[11px] font-semibold text-zinc-900">
          {item.author}
          {item.role && (
            <span className="font-medium text-zinc-400"> · {item.role}</span>
          )}
        </p>
        {proof.length > 1 && (
          <div className="mt-3 flex items-center gap-1.5">
            {proof.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Testimonial ${i + 1}`}
                className={`h-1.5 cursor-pointer rounded-full transition-all ${
                  i === index ? "w-5 bg-[#1E60FF]" : "w-1.5 bg-zinc-300"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FirmStorefrontPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await getFirmStorefront(slug);
        if (!cancelled) setData(res.data?.data || null);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          if (err.response?.status !== 404)
            toast.error(apiError(err, "Failed to load firm"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    getProfile()
      .then((res) => {
        const p = res.data?.data || res.data;
        setProfileId(p?.id || p?._id || null);
      })
      .catch(() => {});
  }, [isLoaded, isSignedIn]);

  const firm = data?.firm;
  const projects = data?.projects || [];
  const team = useMemo(
    () => (data?.team || []).filter((m) => m.role?.facing !== "internal"),
    [data],
  );
  const isOwner =
    data?.isOwner === true ||
    (!!profileId && !!firm && String(firm.ownerId) === String(profileId));
  const frontDeskId = idOf(firm?.frontDeskAgentId);

  const handleChat = () => {
    if (!frontDeskId) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${personaRoutes.firm(slug)}`);
      return;
    }
    router.push(`${personaRoutes.agentRun(frontDeskId)}?threadId=new`);
  };

  useDashboardHeader(
    {
      title: firm?.name || "Firm",
      description: firm?.tagline || "Storefront",
      leading: firm ? <FirmAvatar firm={firm} className="size-8" /> : null,
      actions: (
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Explore
          </Link>
          {frontDeskId && (
            <button
              type="button"
              onClick={handleChat}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-[#1E60FF] px-4 text-[12px] font-bold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:bg-[#154ed0] active:scale-98"
            >
              <MessageSquare className="size-3.5" />
              Chat with the firm
            </button>
          )}
        </div>
      ),
    },
    [firm, frontDeskId, isSignedIn],
  );

  if (loading) {
    return (
      <div className="flex-grow overflow-y-auto bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
            <div className="space-y-4">
              <Skeleton className="h-24 w-24 rounded-3xl" />
              <Skeleton className="h-8 w-48 rounded-lg" />
              <Skeleton className="h-4 w-64 rounded-md" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-6 w-32 rounded-md" />
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-[24px]" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="flex-grow overflow-y-auto bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Explore
          </Link>
          <Empty className="rounded-2xl border border-dashed py-20">
            <EmptyHeader>
              <EmptyTitle>Firm not found</EmptyTitle>
              <EmptyDescription>
                This firm may not be published yet, or the link has changed.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    );
  }

  const stats = firm.stats || {};
  const mandate = firm.mandate || {};

  return (
    <div className="flex-grow overflow-y-auto bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {isOwner && (
          <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-[#1E60FF]/15 bg-[#1E60FF]/5 px-4 py-3 sm:flex-row sm:items-center">
            <p className="text-[13px] font-semibold text-zinc-800">
              This is your firm
              <span className="font-medium text-zinc-500">
                {" "}
                · clients see exactly this page.
              </span>
            </p>
            <Link
              href={`${studioRoutes.home}/firm`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#1E60FF]/20 bg-white px-3.5 py-1.5 text-[12px] font-bold text-[#1E60FF] transition-colors hover:bg-[#1E60FF]/10"
            >
              <SlidersHorizontal className="size-3.5" />
              Edit in Studio
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[340px_1fr] lg:gap-14">
          {/* Left: identity */}
          <aside className="self-start lg:sticky lg:top-6">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-7"
            >
              <div>
                <FirmAvatar
                  firm={firm}
                  className="size-24 rounded-3xl"
                  rounded="rounded-3xl"
                />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600">
                    {categoryLabel(firm.category)}
                  </span>
                </div>
                <h1 className="font-display mt-3 text-3xl leading-tight font-semibold tracking-tight text-zinc-900">
                  {firm.name}
                </h1>
                {firm.tagline && (
                  <p className="mt-1.5 text-[15px] leading-snug font-medium text-zinc-500">
                    {firm.tagline}
                  </p>
                )}
                {firm.bio && (
                  <p className="mt-4 text-[13.5px] leading-relaxed whitespace-pre-line text-zinc-700">
                    {firm.bio}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-zinc-100 p-4">
                  <p className="font-display text-2xl font-semibold text-zinc-900 tabular-nums">
                    {stats.projectsStarted || 0}
                  </p>
                  <p className="text-[11px] font-semibold text-zinc-400">
                    projects started
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-100 p-4">
                  <p className="font-display text-2xl font-semibold text-zinc-900 tabular-nums">
                    {stats.projectsCompleted || 0}
                  </p>
                  <p className="text-[11px] font-semibold text-zinc-400">
                    completed
                  </p>
                </div>
              </div>

              {frontDeskId && (
                <button
                  type="button"
                  onClick={handleChat}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1E60FF] px-5 py-3 text-[13px] font-bold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:bg-[#154ed0] active:scale-98"
                >
                  <MessageSquare className="size-4" />
                  Chat with the firm
                </button>
              )}

              {firm.expertise?.length > 0 && (
                <div>
                  <SectionLabel>What we know</SectionLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {firm.expertise.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full bg-[#1E60FF]/5 px-3 py-1 text-[12px] font-semibold text-[#1E60FF]"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(mandate.takes?.length > 0 || mandate.refuses?.length > 0) && (
                <div className="grid gap-4">
                  {mandate.takes?.length > 0 && (
                    <div>
                      <SectionLabel>We take</SectionLabel>
                      <ul className="flex flex-col gap-1.5">
                        {mandate.takes.map((t) => (
                          <li
                            key={t}
                            className="flex items-start gap-2 text-[13px] text-zinc-700"
                          >
                            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {mandate.refuses?.length > 0 && (
                    <div>
                      <SectionLabel>We don&apos;t take</SectionLabel>
                      <ul className="flex flex-col gap-1.5">
                        {mandate.refuses.map((t) => (
                          <li
                            key={t}
                            className="flex items-start gap-2 text-[13px] text-zinc-500"
                          >
                            <X className="mt-0.5 size-3.5 shrink-0 text-zinc-300" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {mandate.clientProfile && (
                <div>
                  <SectionLabel>Who we work best with</SectionLabel>
                  <p className="text-[13px] leading-relaxed text-zinc-700">
                    {mandate.clientProfile}
                  </p>
                </div>
              )}

              <Testimonials proof={firm.proof} />
            </motion.div>
          </aside>

          {/* Right: projects + team */}
          <div className="flex min-w-0 flex-col gap-12">
            <section>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <SectionLabel>Projects</SectionLabel>
                  <h2 className="font-display -mt-1 text-xl font-semibold tracking-tight text-zinc-900">
                    Outcomes with a date
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-zinc-400">
                  {projects.length}{" "}
                  {projects.length === 1 ? "project" : "projects"}
                </span>
              </div>
              {projects.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-zinc-200 px-6 py-14 text-center">
                  <p className="text-[14px] font-semibold text-zinc-800">
                    No projects listed yet
                  </p>
                  <p className="mt-1 text-[12px] font-medium text-zinc-400">
                    {frontDeskId
                      ? "Chat with the firm to ask about custom work."
                      : "Check back soon."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {projects.map((project, i) => (
                    <motion.div
                      key={project._id || project.slug}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.05 }}
                    >
                      <ProjectCard firmSlug={slug} project={project} />
                    </motion.div>
                  ))}
                </div>
              )}
            </section>

            {team.length > 0 && (
              <section>
                <SectionLabel>Team</SectionLabel>
                <h2 className="font-display -mt-1 mb-4 text-xl font-semibold tracking-tight text-zinc-900">
                  Who you&apos;ll work with
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {team.map((member, i) => (
                    <motion.div
                      key={member._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.05 }}
                      className="flex gap-3.5 rounded-2xl border border-zinc-100 bg-white p-4"
                    >
                      <Avatar className="size-12 shrink-0 rounded-2xl border border-zinc-100">
                        <AvatarImage
                          src={member.avatarUrl}
                          alt={member.name}
                          className="rounded-2xl object-cover"
                        />
                        <AvatarFallback className="rounded-2xl bg-zinc-100 text-zinc-500">
                          <Bot className="size-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-zinc-900">
                          {member.name}
                        </p>
                        {member.role?.title && (
                          <p className="text-[11px] font-bold tracking-wide text-[#1E60FF] uppercase">
                            {member.role.title}
                          </p>
                        )}
                        {member.role?.mandate && (
                          <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-zinc-500">
                            {member.role.mandate}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
