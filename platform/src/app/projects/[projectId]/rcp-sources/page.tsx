"use client";

import { useParams } from "next/navigation";
import { WrenchIcon } from "@phosphor-icons/react";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectRcpSources } from "@/lib/api/projects";

interface RcpSource {
  _id: string;
  name: string;
  url?: string;
  isEnabled?: boolean;
}

export default function RcpSourcesPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<RcpSource>
      title="RCP"
      description="REST Connector Protocol sources an Agent can attach as tools."
      icon={WrenchIcon}
      fetchItems={() => getProjectRcpSources(projectId)}
      cacheKey={`GET /projects/${projectId}/rcp-sources`}
      newHref={`/projects/${projectId}/rcp-sources/new`}
      getRowHref={(source) => `/projects/${projectId}/rcp-sources/${source._id}/edit`}
      emptyDescription="Register a source URL to give Agents new tools."
      columns={[
        { header: "Name", cell: (source) => source.name },
        { header: "URL", cell: (source) => source.url || "—" },
        { header: "Status", cell: (source) => (source.isEnabled === false ? "Disabled" : "Enabled") },
      ]}
    />
  );
}
