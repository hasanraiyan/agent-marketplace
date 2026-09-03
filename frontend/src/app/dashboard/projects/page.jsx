"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { motion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Bot, Briefcase, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { getMyClientProjects } from "@/lib/api/client-projects";
import { personaRoutes } from "@/lib/studio-routes";
import { FirmAvatar, StatusBadge, apiError } from "@/components/firms";
import { cn } from "@/lib/utils";

const STATUS_ORDER = { blocked: 0, active: 1, done: 2, cancelled: 3 };

function dueLabel(project) {
  if (project.status === "done") {
    return project.completedAt
      ? `Completed ${formatDistanceToNow(new Date(project.completedAt), { addSuffix: true })}`
      : "Completed";
  }
  if (!project.dueAt) return null;
  const due = new Date(project.dueAt);
  const overdue = due < new Date();
  return `${overdue ? "Was due" : "Due"} ${formatDistanceToNow(due, { addSuffix: true })}`;
}

function ProjectRow({ project, index }) {
  const firm = project.firmId || {};
  const lead = project.leadAgentId || {};
  const openCount = (project.inbox || []).filter(
    (i) => i.status !== "done",
  ).length;
  const due = dueLabel(project);
  const overdue =
    project.status !== "done" &&
    project.dueAt &&
    new Date(project.dueAt) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04 }}
    >
      <Link
        href={personaRoutes.project(project._id)}
        className="group flex flex-col gap-4 rounded-[24px] border border-zinc-100 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-[0_12px_40px_-16px_rgba(24,24,27,0.18)] sm:flex-row sm:items-center sm:gap-6"
      >
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <FirmAvatar firm={firm} className="size-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-zinc-400">
              {firm.name || "Firm"}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h3 className="font-display truncate text-[16px] font-semibold tracking-tight text-zinc-900">
                {project.title}
              </h3>
              <StatusBadge status={project.status} size="sm" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-medium text-zinc-500">
              {lead.name && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="size-4 rounded-md">
                    <AvatarImage
                      src={lead.avatarUrl}
                      alt={lead.name}
                      className="rounded-md object-cover"
                    />
                    <AvatarFallback className="rounded-md bg-zinc-100">
                      <Bot className="size-2.5 text-zinc-400" />
                    </AvatarFallback>
                  </Avatar>
                  {lead.name}
                </span>
              )}
              {due && (
                <span className={cn(overdue && "font-semibold text-red-500")}>
                  {due}
                </span>
              )}
              {openCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-700">
                  <Inbox className="size-3" />
                  {openCount} needed from you
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:w-56 sm:shrink-0">
          <div className="flex-1">
            <div className="mb-1.5 flex justify-between text-[10.5px] font-semibold text-zinc-400">
              <span>Progress</span>
              <span className="text-zinc-700 tabular-nums">
                {Math.round(project.progress || 0)}%
              </span>
            </div>
            <Progress
              value={project.progress || 0}
              className={cn(
                "h-1.5 bg-zinc-100",
                project.status === "done"
                  ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
                  : "[&_[data-slot=progress-indicator]]:bg-[#1E60FF]",
              )}
            />
          </div>
          <ArrowRight className="size-4 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#1E60FF]" />
        </div>
      </Link>
    </motion.div>
  );
}

export default function MyProjectsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useDashboardHeader(
    {
      title: "My Projects",
      description: "Work you've commissioned from firms",
      actions: (
        <Link
          href="/dashboard"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#1E60FF] px-4 text-[12px] font-bold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:bg-[#154ed0] active:scale-98"
        >
          Find a firm
        </Link>
      ),
    },
    [],
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${personaRoutes.projects}`);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await getMyClientProjects();
        if (!cancelled) setProjects(res.data?.data || []);
      } catch (err) {
        if (!cancelled) toast.error(apiError(err, "Failed to load projects"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, router]);

  const sorted = useMemo(
    () =>
      [...projects].sort((a, b) => {
        const s = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        if (s !== 0) return s;
        return new Date(b.startedAt || 0) - new Date(a.startedAt || 0);
      }),
    [projects],
  );

  const openTotal = projects.reduce(
    (acc, p) => acc + (p.inbox || []).filter((i) => i.status !== "done").length,
    0,
  );

  return (
    <div className="flex-grow overflow-y-auto bg-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8">
          <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-[#1E60FF] uppercase">
            Your work in flight
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">
            My projects
          </h1>
          {!loading && projects.length > 0 && (
            <p className="mt-2 text-sm font-medium text-zinc-500">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
              {openTotal > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold text-amber-700">
                    {openTotal} {openTotal === 1 ? "thing" : "things"} needed
                    from you
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {loading || !isLoaded ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[112px] rounded-[24px]" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center rounded-[24px] border border-dashed border-zinc-200 px-6 py-20 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full border border-[#1E60FF]/10 bg-[#1E60FF]/5 text-[#1E60FF]">
              <Briefcase className="size-7" />
            </div>
            <h3 className="font-display text-lg font-semibold text-zinc-900">
              No projects yet
            </h3>
            <p className="mt-1 max-w-xs text-sm text-zinc-400">
              Pick a firm, choose an outcome, and their team gets to work.
            </p>
            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#1E60FF] px-4 py-2 text-[13px] font-bold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:bg-[#154ed0]"
            >
              Find a firm
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((project, i) => (
              <ProjectRow key={project._id} project={project} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
