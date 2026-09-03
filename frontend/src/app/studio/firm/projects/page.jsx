"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ClockIcon,
  ListChecksIcon,
  PackageIcon,
  PlusIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import {
  deleteFirmProjectTemplate,
  getMyFirmProjects,
  updateFirmProjectTemplate,
} from "@/lib/api/firms";
import { studioRoutes } from "@/lib/studio-routes";
import { useFirm } from "@/components/studio/firm-context";
import { useFirmTeam } from "@/components/studio/use-firm-team";
import {
  FirmEmpty,
  RequireFirm,
  StatusPill,
  formatPrice,
} from "@/components/studio/firm-primitives";

const idOf = (v) => (v && typeof v === "object" ? v._id : v) || "";

function ProjectRow({ project, lead, index, onToggle, onDelete, toggling }) {
  const router = useRouter();
  const href = studioRoutes.firmProject(project._id);
  const published = project.status === "published";
  const deliverables = project.deliverables?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
      className="group grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_88px_92px_150px_auto] dark:hover:bg-slate-900/40"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="truncate text-sm font-bold text-slate-900 hover:underline dark:text-slate-100"
          >
            {project.title}
          </Link>
          <StatusPill status={project.status} />
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          {project.outcome}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400 md:hidden dark:text-slate-500">
          <span>{formatPrice(project.price)}</span>
          {project.durationDays ? <span>{project.durationDays}d</span> : null}
          <span>{deliverables} deliverable{deliverables === 1 ? "" : "s"}</span>
          <span>{lead ? lead.name : "No lead"}</span>
        </div>
      </div>

      <div className="hidden text-sm font-bold text-slate-900 tabular-nums md:block dark:text-slate-100">
        {formatPrice(project.price)}
      </div>
      <div className="hidden items-center gap-1.5 text-xs font-semibold text-slate-500 md:flex dark:text-slate-400">
        <ClockIcon className="size-3.5 text-slate-350 dark:text-slate-600" />
        {project.durationDays ? `${project.durationDays} days` : "—"}
      </div>
      <div className="hidden min-w-0 flex-col md:flex">
        <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-slate-700 dark:text-slate-300">
          <UserRoundIcon className="size-3.5 shrink-0 text-slate-350 dark:text-slate-600" />
          {lead ? lead.name : <span className="text-amber-600">No lead</span>}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          <ListChecksIcon className="size-3.5 shrink-0" />
          {deliverables} deliverable{deliverables === 1 ? "" : "s"}
        </span>
      </div>

      <div
        className="flex items-center gap-2 justify-self-end"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span className="hidden sm:inline">{published ? "Live" : "Draft"}</span>
          <Switch
            checked={published}
            disabled={toggling}
            onCheckedChange={(next) => onToggle(project, next)}
            aria-label={published ? "Unpublish project" : "Publish project"}
          />
        </label>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete project"
          onClick={() => onDelete(project)}
          className="text-slate-400 hover:text-rose-600"
        >
          <Trash2Icon />
        </Button>
      </div>
    </motion.div>
  );
}

function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { team } = useFirmTeam();

  const byId = useMemo(
    () => Object.fromEntries(team.map((a) => [a._id, a])),
    [team],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMyFirmProjects();
        if (!cancelled) setProjects(res.data?.data || []);
      } catch (err) {
        if (!cancelled)
          toast.error(err.response?.data?.message || "Failed to load projects");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (project, next) => {
    const status = next ? "published" : "draft";
    setToggling(project._id);
    try {
      const res = await updateFirmProjectTemplate(project._id, { status });
      const updated = res.data?.data || { ...project, status };
      setProjects((list) =>
        list.map((p) => (p._id === project._id ? { ...p, ...updated } : p)),
      );
      toast.success(next ? `“${project.title}” is live` : `“${project.title}” moved to draft`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update project");
    } finally {
      setToggling(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFirmProjectTemplate(deleteTarget._id);
      setProjects((list) => list.filter((p) => p._id !== deleteTarget._id));
      toast.success("Project deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <FirmEmpty
        icon={PackageIcon}
        title="No projects yet"
        description="A project is what clients buy: a named outcome, the deliverables that prove it, and the employee who runs it."
        action={
          <Link href={studioRoutes.firmProjectNew}>
            <Button className="rounded-full px-6 font-bold">
              <PlusIcon />
              New project
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="divide-y divide-slate-150/70 overflow-hidden rounded-2xl border border-slate-150/70 bg-white dark:divide-slate-850/60 dark:border-slate-850/60 dark:bg-slate-950/40">
        <div className="hidden grid-cols-[minmax(0,1fr)_88px_92px_150px_auto] gap-x-4 px-4 py-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase md:grid dark:text-slate-500">
          <span>Project</span>
          <span>Price</span>
          <span>Duration</span>
          <span>Lead · Scope</span>
          <span className="justify-self-end pr-1">Live</span>
        </div>
        {projects.map((project, index) => (
          <ProjectRow
            key={project._id}
            index={index}
            project={project}
            lead={byId[idOf(project.leadAgentId)]}
            toggling={toggling === project._id}
            onToggle={toggle}
            onDelete={setDeleteTarget}
          />
        ))}
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The template is removed from your storefront. Projects clients have
              already started are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function FirmProjectsPage() {
  const { firm } = useFirm();

  useDashboardHeader(
    {
      title: "Projects",
      description: "What your firm sells — an outcome, its deliverables, and the employee who runs it.",
      actions: firm ? (
        <Link href={studioRoutes.firmProjectNew}>
          <Button size="sm" className="rounded-full px-4 font-bold">
            <PlusIcon className="mr-1.5 size-4" />
            New project
          </Button>
        </Link>
      ) : null,
    },
    [Boolean(firm)],
  );

  return (
    <RequireFirm>
      <ProjectList />
    </RequireFirm>
  );
}
