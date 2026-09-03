"use client";

import Link from "next/link";
import { BotIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { studioRoutes } from "@/lib/studio-routes";
import { useFirm } from "@/components/studio/firm-context";
import { useFirmTeam } from "@/components/studio/use-firm-team";
import { FirmEmpty, RequireFirm } from "@/components/studio/firm-primitives";
import { FirmTeamRow } from "@/components/studio/firm-team-row";

function TeamList() {
  const { refresh: refreshFirm } = useFirm();
  const { team, setTeam, loading, refresh: refreshTeam } = useFirmTeam();

  const replace = (updated) =>
    setTeam((list) => list.map((a) => (a._id === updated._id ? updated : a)));

  const onRefresh = () => {
    refreshFirm();
    refreshTeam();
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (team.length === 0) {
    return (
      <FirmEmpty
        icon={BotIcon}
        title="No agents to hire yet"
        description="Employees are your agents. Build one, then come back to put it on the team."
        action={
          <Link href={studioRoutes.agentNew}>
            <Button className="rounded-full px-6 font-bold">
              <PlusIcon />
              Create an agent
            </Button>
          </Link>
        }
      />
    );
  }

  const members = team.filter((a) => a.isMember);
  const others = team.filter((a) => !a.isMember);

  return (
    <div className="flex flex-col gap-6">
      {members.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-wider text-slate-450 uppercase dark:text-slate-500">
            Employees · {members.length}
          </h2>
          {members.map((agent, i) => (
            <FirmTeamRow
              key={agent._id}
              index={i}
              agent={agent}
              onChange={replace}
              onRefresh={onRefresh}
            />
          ))}
        </section>
      ) : null}
      {others.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-wider text-slate-450 uppercase dark:text-slate-500">
            {members.length ? "Other agents" : "Your agents"} · {others.length}
          </h2>
          {others.map((agent, i) => (
            <FirmTeamRow
              key={agent._id}
              index={i}
              agent={agent}
              onChange={replace}
              onRefresh={onRefresh}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

export default function FirmTeamPage() {
  useDashboardHeader(
    {
      title: "Team",
      description:
        "Employees are your agents. The front desk talks to visitors; leads run projects; internal employees are delegated to.",
      actions: (
        <Link href={studioRoutes.agentNew}>
          <Button size="sm" variant="outline" className="rounded-full font-bold">
            <PlusIcon className="mr-1.5 size-3.5" />
            New agent
          </Button>
        </Link>
      ),
    },
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        Employees are your agents. The front desk talks to visitors; leads run
        projects; internal employees are delegated to.
      </p>
      <RequireFirm>
        <TeamList />
      </RequireFirm>
    </div>
  );
}
