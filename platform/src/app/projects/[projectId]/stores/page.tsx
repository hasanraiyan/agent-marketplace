"use client";

import { useParams } from "next/navigation";
import { DatabaseIcon } from "@phosphor-icons/react";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectStores } from "@/lib/api/projects";

interface Store {
  _id: string;
  name: string;
  scope?: string;
}

export default function StoresPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<Store>
      title="Stores"
      description="Named, scoped mount points assignable to Agents."
      icon={DatabaseIcon}
      fetchItems={() => getProjectStores(projectId)}
      cacheKey={`GET /projects/${projectId}/stores`}
      newHref={`/projects/${projectId}/stores/new`}
      getRowHref={(store) => `/projects/${projectId}/stores/${store._id}/edit`}
      emptyDescription="Create a Store to give Agents a persistent, scoped place to write data."
      columns={[
        { header: "Name", cell: (store) => store.name },
        { header: "Scope", cell: (store) => store.scope || "—" },
      ]}
    />
  );
}
