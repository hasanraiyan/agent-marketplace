"use client";

import { useParams } from "next/navigation";
import { RobotIcon } from "@phosphor-icons/react";
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
      newHref={`/projects/${projectId}/agents/new`}
      getRowHref={(agent) => `/projects/${projectId}/agents/${agent._id}/edit`}
      emptyDescription="Create an Agent to start testing it in the Playground."
      columns={[
        { header: "Name", cell: (agent) => agent.name },
        { header: "Description", cell: (agent) => agent.description || "—" },
      ]}
    />
  );
}
