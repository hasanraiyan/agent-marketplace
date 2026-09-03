"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  BriefcaseIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  PackageIcon,
  PlayIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { getMyFirmClients, getMyFirmProjects } from "@/lib/api/firms";
import { personaRoutes, studioRoutes } from "@/lib/studio-routes";
import { useFirm } from "@/components/studio/firm-context";
import { useFirmTeam } from "@/components/studio/use-firm-team";
import { FirmCreateHero } from "@/components/studio/firm-create-hero";
import { FirmStatusCard } from "@/components/studio/firm-status-card";
import { FirmStorefrontEditor } from "@/components/studio/firm-storefront-editor";
import { QuickLink, StatTile } from "@/components/studio/firm-primitives";

function FirmOffice() {
  const { firm } = useFirm();
  const { team, loading: loadingTeam, refresh: refreshTeam } = useFirmTeam();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, c] = await Promise.allSettled([
        getMyFirmProjects(),
        getMyFirmClients(),
      ]);
      if (cancelled) return;
      setProjects(p.status === "fulfilled" ? p.value.data?.data || [] : []);
      setClients(c.status === "fulfilled" ? c.value.data?.data || [] : []);
      setLoadingStats(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const employees = team.filter((a) => a.isMember);
  const publishedTemplates = projects.filter((p) => p.status === "published");
  const activeClients = clients.filter(
    (c) => c.status === "active" || c.status === "blocked",
  );
  const stats = firm.stats || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      <FirmStatusCard />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile
          label="Started"
          value={stats.projectsStarted || 0}
          icon={PlayIcon}
          hint="client projects"
        />
        <StatTile
          label="Completed"
          value={stats.projectsCompleted || 0}
          icon={CheckCircle2Icon}
          hint="delivered & accepted"
        />
        <StatTile
          label="Projects"
          value={projects.length}
          icon={PackageIcon}
          hint={`${publishedTemplates.length} published`}
          loading={loadingStats}
        />
        <StatTile
          label="Employees"
          value={employees.length}
          icon={UsersIcon}
          hint={`${team.length} agents total`}
          loading={loadingTeam}
        />
        <StatTile
          label="Active clients"
          value={activeClients.length}
          icon={BriefcaseIcon}
          hint={`${clients.length} all time`}
          loading={loadingStats}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickLink
          href={studioRoutes.firmProjects}
          title="Projects"
          icon={PackageIcon}
          hint={
            loadingStats
              ? "…"
              : projects.length
                ? `${projects.length} template${projects.length === 1 ? "" : "s"}`
                : "Package your first offer"
          }
        />
        <QuickLink
          href={studioRoutes.firmTeam}
          title="Team"
          icon={UsersIcon}
          hint={
            loadingTeam
              ? "…"
              : employees.length
                ? `${employees.length} employee${employees.length === 1 ? "" : "s"}`
                : "Turn agents into employees"
          }
        />
        <QuickLink
          href={studioRoutes.firmClients}
          title="Clients"
          icon={BriefcaseIcon}
          hint={
            loadingStats
              ? "…"
              : activeClients.length
                ? `${activeClients.length} in progress`
                : "Watch projects run"
          }
        />
      </section>

      <FirmStorefrontEditor team={team} onTeamChange={refreshTeam} />
    </motion.div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

export default function FirmOverviewPage() {
  const { firm, loading, notFound } = useFirm();
  const published = firm?.status === "published";

  useDashboardHeader(
    {
      title: "My Firm",
      description: firm
        ? firm.tagline || "Your one-person company."
        : "Your one-person company, built for you.",
      actions: published ? (
        <Link href={personaRoutes.firm(firm.slug)} target="_blank">
          <Button variant="outline" size="sm" className="rounded-full font-bold">
            <ExternalLinkIcon className="mr-1.5 size-3.5" />
            View storefront
          </Button>
        </Link>
      ) : null,
    },
    [firm?.tagline, firm?.slug, published],
  );

  if (loading) return <OverviewSkeleton />;
  if (notFound) return <FirmCreateHero />;
  return <FirmOffice />;
}
