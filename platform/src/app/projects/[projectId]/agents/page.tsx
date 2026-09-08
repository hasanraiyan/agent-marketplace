"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { PlayIcon, RobotIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectAgents } from "@/lib/api/projects";

interface Agent {
  _id: string;
  name: string;
  description?: string;
}

export default function AgentsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<Agent>
      title="Agents"
      description="The Agents this Project can run."
      icon={RobotIcon}
      fetchItems={() => getProjectAgents(projectId)}
      cacheKey={`GET /projects/${projectId}/agents`}
      newHref={`/projects/${projectId}/agents/new`}
      getRowHref={(agent) => `/projects/${projectId}/agents/${agent._id}/edit`}
      emptyDescription="Create an Agent to start testing it in the Playground."
      columns={[
        { header: "Name", cell: (agent) => agent.name },
        { header: "Description", cell: (agent) => agent.description || "—" },
        {
          header: "",
          className: "w-32 text-right shrink-0",
          cell: (agent) => (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-2.5 text-xs hover:border-primary/40 hover:bg-primary/5"
                render={
                  <Link
                    href={`/projects/${projectId}/playground?agentId=${agent._id}`}
                  />
                }
              >
                <PlayIcon className="size-3 text-primary" weight="fill" />
                <span>Test Agent</span>
              </Button>
            </div>
          ),
        },
      ]}
    />
  );
}
