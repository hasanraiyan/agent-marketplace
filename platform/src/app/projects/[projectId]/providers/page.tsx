"use client";

import { useParams } from "next/navigation";
import { CpuIcon } from "@phosphor-icons/react";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectProviders } from "@/lib/api/projects";

interface Provider {
  _id: string;
  name: string;
  type?: string;
}

export default function ProvidersPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<Provider>
      title="Providers"
      description="Model providers an Agent can use."
      icon={CpuIcon}
      fetchItems={() => getProjectProviders(projectId)}
      newHref={`/projects/${projectId}/providers/new`}
      getRowHref={(provider) => `/projects/${projectId}/providers/${provider._id}/edit`}
      emptyDescription="Add a provider (OpenAI, Anthropic, etc.) to power your Agents."
      columns={[
        { header: "Name", cell: (provider) => provider.name },
        { header: "Type", cell: (provider) => provider.type || "—" },
      ]}
    />
  );
}
