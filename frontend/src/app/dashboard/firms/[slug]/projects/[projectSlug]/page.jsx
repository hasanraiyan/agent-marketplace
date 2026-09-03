"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  ClipboardList,
  Flag,
  UserRound,
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
import { getFirmProject, getFirmStorefront } from "@/lib/api/firms";
import { personaRoutes } from "@/lib/studio-routes";
import {
  FirmAvatar,
  StartProjectSheet,
  apiError,
  formatDuration,
  formatPrice,
} from "@/components/firms";

function SectionHeading({ eyebrow, title }) {
  return (
    <div className="mb-4">
      <p className="mb-1 font-mono text-[10px] tracking-[0.18em] text-[#1E60FF] uppercase">
        {eyebrow}
      </p>
      <h2 className="font-display text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">
        {title}
      </h2>
    </div>
  );
}

const markdownComponents = {
  h1: (props) => (
    <h3
      className="font-display mt-6 mb-2 text-lg font-semibold text-zinc-900"
      {...props}
    />
  ),
  h2: (props) => (
    <h3
      className="font-display mt-6 mb-2 text-lg font-semibold text-zinc-900"
      {...props}
    />
  ),
  h3: (props) => (
    <h4 className="mt-5 mb-1.5 text-[15px] font-semibold text-zinc-900" {...props} />
  ),
  p: (props) => (
    <p className="my-2.5 text-[14px] leading-relaxed text-zinc-700" {...props} />
  ),
  ul: (props) => (
    <ul className="my-2.5 list-disc pl-5 text-[14px] leading-relaxed text-zinc-700 marker:text-zinc-300" {...props} />
  ),
  ol: (props) => (
    <ol className="my-2.5 list-decimal pl-5 text-[14px] leading-relaxed text-zinc-700 marker:text-zinc-400" {...props} />
  ),
  li: (props) => <li className="my-0.5" {...props} />,
  a: (props) => (
    <a
      className="font-semibold text-[#1E60FF] underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  strong: (props) => <strong className="font-semibold text-zinc-900" {...props} />,
  code: (props) => (
    <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[12px] text-zinc-800" {...props} />
  ),
  blockquote: (props) => (
    <blockquote className="my-3 border-l-2 border-[#1E60FF]/40 pl-3 text-zinc-600 italic" {...props} />
  ),
};

export default function FirmProjectPage() {
  const { slug, projectSlug } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();
  const [project, setProject] = useState(null);
  const [firm, setFirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [projectRes, firmRes] = await Promise.all([
          getFirmProject(slug, projectSlug),
          getFirmStorefront(slug).catch(() => null),
        ]);
        if (cancelled) return;
        setProject(projectRes.data?.data || null);
        setFirm(firmRes?.data?.data?.firm || null);
      } catch (err) {
        if (!cancelled) {
          setProject(null);
          if (err.response?.status !== 404)
            toast.error(apiError(err, "Failed to load project"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, projectSlug]);

  const handleStart = () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
      return;
    }
    setSheetOpen(true);
  };

  useDashboardHeader(
    {
      title: project?.title || "Project",
      description: firm?.name ? `by ${firm.name}` : "Project",
      leading: firm ? <FirmAvatar firm={firm} className="size-8" /> : null,
      actions: (
        <div className="flex items-center gap-2">
          <Link
            href={personaRoutes.firm(slug)}
            className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">{firm?.name || "Firm"}</span>
          </Link>
          {project && (
            <button
              type="button"
              onClick={handleStart}
              className="hidden h-8 cursor-pointer items-center gap-1.5 rounded-full bg-[#1E60FF] px-4 text-[12px] font-bold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:bg-[#154ed0] active:scale-98 sm:inline-flex"
            >
              Start this project
            </button>
          )}
        </div>
      ),
    },
    [project, firm, slug, isLoaded, isSignedIn],
  );

  if (loading) {
    return (
      <div className="flex-grow overflow-y-auto bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="mt-4 h-10 w-2/3 rounded-lg" />
          <Skeleton className="mt-3 h-5 w-1/2 rounded-md" />
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-grow overflow-y-auto bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href={personaRoutes.firm(slug)}
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to the firm
          </Link>
          <Empty className="rounded-2xl border border-dashed py-20">
            <EmptyHeader>
              <EmptyTitle>Project not found</EmptyTitle>
              <EmptyDescription>
                This project may no longer be offered.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    );
  }

  const lead = project.leadAgentId;
  const leadName = typeof lead === "object" ? lead?.name : null;
  const duration = formatDuration(project.durationDays);
  const deliverables = project.deliverables || [];
  const checkpoints = project.checkpoints || [];
  const inputs = project.inputs || [];
  const whoFor = project.whoFor || [];

  const cta = (
    <button
      type="button"
      onClick={handleStart}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1E60FF] px-5 py-3 text-[13px] font-bold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:bg-[#154ed0] active:scale-98"
    >
      Start this project
      <ArrowRight className="size-4" />
    </button>
  );

  return (
    <div className="flex-grow overflow-y-auto bg-white">
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-32 sm:px-6 lg:px-8 lg:pb-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            href={personaRoutes.firm(slug)}
            className="group inline-flex items-center gap-2.5 rounded-full border border-zinc-100 py-1 pr-3.5 pl-1 transition-colors hover:border-zinc-200 hover:bg-zinc-50"
          >
            {firm ? (
              <FirmAvatar firm={firm} className="size-6 rounded-lg" rounded="rounded-lg" />
            ) : (
              <span className="size-6 rounded-lg bg-zinc-100" />
            )}
            <span className="text-[12px] font-semibold text-zinc-700">
              {firm?.name || "Back to the firm"}
            </span>
          </Link>
          <h1 className="font-display mt-5 max-w-3xl text-3xl leading-[1.1] font-semibold tracking-tight text-zinc-900 md:text-[44px]">
            {project.title}
          </h1>
          {project.outcome && (
            <p className="mt-4 max-w-2xl text-[16px] leading-relaxed font-medium text-zinc-600 md:text-lg">
              {project.outcome}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-900 px-3 py-1 text-[12px] font-bold text-white tabular-nums">
              {formatPrice(project.price)}
            </span>
            {duration && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-100 bg-zinc-50 px-3 py-1 text-[12px] font-semibold text-zinc-600">
                <CalendarClock className="size-3.5" />
                {duration}
              </span>
            )}
            {leadName && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-100 bg-zinc-50 py-1 pr-3 pl-1 text-[12px] font-semibold text-zinc-600">
                <Avatar className="size-5 rounded-md">
                  <AvatarImage src={lead.avatarUrl} alt={leadName} className="rounded-md object-cover" />
                  <AvatarFallback className="rounded-md bg-zinc-200 text-zinc-500">
                    <Bot className="size-3" />
                  </AvatarFallback>
                </Avatar>
                Led by {leadName}
              </span>
            )}
          </div>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:mt-12 lg:grid-cols-[1fr_320px] lg:gap-14">
          {/* Body */}
          <div className="flex min-w-0 flex-col gap-12">
            {whoFor.length > 0 && (
              <section>
                <SectionHeading eyebrow="Is this you?" title="Are you…" />
                <ul className="grid gap-2 sm:grid-cols-2">
                  {whoFor.map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2.5 rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-[13.5px] leading-snug text-zinc-700"
                    >
                      <UserRound className="mt-0.5 size-4 shrink-0 text-[#1E60FF]" />
                      {line}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {deliverables.length > 0 && (
              <section>
                <SectionHeading
                  eyebrow="What you'll get"
                  title="Here's what we will work on"
                />
                <ol className="flex flex-col gap-2">
                  {deliverables.map((d, i) => (
                    <li
                      key={`${i}-${d.name}`}
                      className="flex gap-3.5 rounded-2xl border border-zinc-100 p-4"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1E60FF]/10 text-[11px] font-bold text-[#1E60FF] tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-zinc-900">
                          {d.name}
                        </p>
                        {d.acceptanceCriteria && (
                          <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-relaxed text-zinc-500">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                            Done when: {d.acceptanceCriteria}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section>
              <SectionHeading eyebrow="How it runs" title="The timeline" />
              <div className="rounded-2xl border border-zinc-100 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
                    <Flag className="size-4" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-zinc-900">
                      {duration
                        ? `Delivered in ${duration}`
                        : "Delivered on the firm's schedule"}
                    </p>
                    <p className="text-[12px] text-zinc-500">
                      The lead employee runs the work day to day inside your
                      project workspace.
                    </p>
                  </div>
                </div>
                {checkpoints.length > 0 && (
                  <div className="mt-5 border-t border-zinc-100 pt-4">
                    <p className="mb-2.5 text-[11px] font-bold tracking-wide text-zinc-400 uppercase">
                      Where the human steps in
                    </p>
                    <ul className="flex flex-col gap-2">
                      {checkpoints.map((c) => (
                        <li
                          key={c}
                          className="flex items-start gap-2.5 text-[13px] text-zinc-700"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#1E60FF]" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            {inputs.length > 0 && (
              <section>
                <SectionHeading
                  eyebrow="Before we start"
                  title="What we'll ask you for"
                />
                <ul className="flex flex-col gap-2">
                  {inputs.map((field) => (
                    <li
                      key={field.key}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/50 px-4 py-3"
                    >
                      <span className="inline-flex items-center gap-2.5 text-[13.5px] font-medium text-zinc-800">
                        <ClipboardList className="size-4 text-zinc-400" />
                        {field.label}
                      </span>
                      <span className="text-[10px] font-bold tracking-wide text-zinc-400 uppercase">
                        {field.required ? "Required" : "Optional"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {project.description && (
              <section>
                <SectionHeading eyebrow="The details" title="About this project" />
                <div className="rounded-2xl border border-zinc-100 px-5 py-2">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {project.description}
                  </ReactMarkdown>
                </div>
              </section>
            )}
          </div>

          {/* Sticky side CTA */}
          <aside className="hidden self-start lg:sticky lg:top-6 lg:block">
            <div className="rounded-[24px] border border-zinc-100 bg-white p-5 shadow-[0_12px_40px_-24px_rgba(24,24,27,0.25)]">
              <p className="text-[11px] font-bold tracking-wide text-zinc-400 uppercase">
                {project.price?.period === "monthly" ? "Monthly" : "One-time"}
              </p>
              <p className="font-display mt-1 text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                {formatPrice(project.price)}
              </p>
              <dl className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 text-[12.5px]">
                {duration && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Timeline</dt>
                    <dd className="font-semibold text-zinc-900">{duration}</dd>
                  </div>
                )}
                {deliverables.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Deliverables</dt>
                    <dd className="font-semibold text-zinc-900">
                      {deliverables.length}
                    </dd>
                  </div>
                )}
                {leadName && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Lead</dt>
                    <dd className="font-semibold text-zinc-900">{leadName}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-5">{cta}</div>
              <p className="mt-3 text-center text-[11px] font-medium text-zinc-400">
                A short onboarding form, then the team begins.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-zinc-900 tabular-nums">
              {formatPrice(project.price)}
            </p>
            {duration && (
              <p className="text-[11px] font-medium text-zinc-400">{duration}</p>
            )}
          </div>
          <div className="flex-1">{cta}</div>
        </div>
      </div>

      <StartProjectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        firmSlug={slug}
        firmName={firm?.name}
        project={project}
      />
    </div>
  );
}
