"use client";

import { useParams } from "next/navigation";
import { DatabaseIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectStores } from "@/lib/api/projects";

interface Store {
  _id: string;
  name: string;
  scope?: string;
  accessMode?: string;
  createdAt?: string;
}

export default function StoresPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<Store>
      title="Stores"
      description="Named, scoped mount points assignable to Agents via their storeMounts."
      icon={DatabaseIcon}
      fetchItems={() => getProjectStores(projectId)}
      cacheKey={`GET /projects/${projectId}/stores`}
      newHref={`/projects/${projectId}/stores/new`}
      getRowHref={(store) => `/projects/${projectId}/stores/${store._id}/edit`}
      emptyDescription="Create a Store to give Agents a persistent, scoped place to write data."
      columns={[
        {
          header: "Name",
          cell: (store) => (
            <span className="flex items-center gap-1.5 font-medium">
              <DatabaseIcon className="size-3.5 text-muted-foreground" />
              {store.name}
            </span>
          ),
        },
        {
          header: "Scope",
          cell: (store) => (
            <Badge variant="outline" className="capitalize">{store.scope || "—"}</Badge>
          ),
        },
        {
          header: "Access",
          className: "hidden md:table-cell",
          cell: (store) => <span className="capitalize">{store.accessMode || "—"}</span>,
        },
        {
          header: "Created",
          className: "hidden lg:table-cell",
          cell: (store) =>
            store.createdAt ? (
              <span className="text-muted-foreground">{new Date(store.createdAt).toLocaleDateString()}</span>
            ) : (
              "—"
            ),
        },
      ]}
    />
  );
}