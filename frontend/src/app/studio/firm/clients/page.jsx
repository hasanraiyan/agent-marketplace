"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import { BriefcaseIcon, InboxIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { getMyFirmClients } from "@/lib/api/firms";
import { studioRoutes } from "@/lib/studio-routes";
import { cn } from "@/lib/utils";
import { useFirm } from "@/components/studio/firm-context";
import {
  AgentAvatar,
  FirmEmpty,
  RequireFirm,
  StatusPill,
} from "@/components/studio/firm-primitives";
import { ClientProjectSheet } from "@/components/studio/client-project-sheet";

const openRequests = (p) => (p.inbox || []).filter((i) => i.status === "open").length;
const lastActivity = (p) => {
  const last = p.activity?.length ? p.activity[p.activity.length - 1]?.at : null;
  return p.lastActivityAt || last || p.startedAt;
};

function ClientsTable() {
  const { firm } = useFirm();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMyFirmClients();
        if (!cancelled) setProjects(res.data?.data || []);
      } catch (err) {
        if (!cancelled)
          toast.error(err.response?.data?.message || "Failed to load clients");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <FirmEmpty
        icon={BriefcaseIcon}
        title="No clients yet"
        description="No clients yet — publish your firm to get discovered."
        action={
          firm?.status !== "published" ? (
            <Link href={studioRoutes.firm}>
              <Button className="rounded-full px-6 font-bold">Go to overview</Button>
            </Link>
          ) : null
        }
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-150/70 bg-white dark:border-slate-850/60 dark:bg-slate-950/40">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-bold tracking-wider uppercase">Client</TableHead>
              <TableHead className="text-[10px] font-bold tracking-wider uppercase">Project</TableHead>
              <TableHead className="text-[10px] font-bold tracking-wider uppercase">Status</TableHead>
              <TableHead className="w-40 text-[10px] font-bold tracking-wider uppercase">Progress</TableHead>
              <TableHead className="text-center text-[10px] font-bold tracking-wider uppercase">Requests</TableHead>
              <TableHead className="text-[10px] font-bold tracking-wider uppercase">Last activity</TableHead>
              <TableHead className="text-[10px] font-bold tracking-wider uppercase">Lead</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p, index) => {
              const client = p.clientId || {};
              const open = openRequests(p);
              const when = lastActivity(p);
              return (
                <motion.tr
                  key={p._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(index, 10) * 0.03 }}
                  tabIndex={0}
                  onClick={() => setSelected(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSelected(p);
                  }}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-900/40"
                >
                  <TableCell>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {client.name || "Client"}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {client.email || ""}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-64">
                    <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {p.title}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={p.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={p.progress || 0} className="h-1.5" />
                      <span className="w-8 text-right text-[11px] font-bold text-slate-600 tabular-nums dark:text-slate-300">
                        {Math.round(p.progress || 0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        "inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                        open
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                      )}
                    >
                      <InboxIcon className="size-3" />
                      {open}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-medium whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {when ? formatDistanceToNow(new Date(when), { addSuffix: true }) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <AgentAvatar agent={p.leadAgentId} className="size-6 rounded-md" />
                      <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {p.leadAgentId?.name || "—"}
                      </span>
                    </div>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ClientProjectSheet
        project={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}

export default function FirmClientsPage() {
  useDashboardHeader(
    {
      title: "Clients",
      description: "Every project a client has started with your firm, and where it stands.",
    },
    [],
  );

  return (
    <RequireFirm>
      <ClientsTable />
    </RequireFirm>
  );
}
