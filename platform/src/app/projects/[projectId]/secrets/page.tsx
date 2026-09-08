"use client";

import { useParams } from "next/navigation";
import { LockKeyIcon } from "@phosphor-icons/react";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectSecrets } from "@/lib/api/projects";

interface Secret {
  _id?: string;
  id: string;
  label: string;
  hasValue?: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  project?: string;
}

export default function SecretsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<Secret>
      title="Secrets"
      description="Bearer tokens the REST Tool Builder's Auth tab can reference — values are never shown again after creation."
      icon={LockKeyIcon}
      fetchItems={() => getProjectSecrets(projectId)}
      newHref={`/projects/${projectId}/secrets/new`}
      getRowHref={(secret) => `/projects/${projectId}/secrets/${secret.id ?? secret._id}/edit`}
      emptyDescription="Store a secret to authenticate REST tools without exposing the value in a tool's config."
      columns={[
        { header: "Label", cell: (secret) => secret.label },
        {
          header: "Created",
          cell: (secret) => (secret.createdAt ? new Date(secret.createdAt).toLocaleDateString() : "—"),
        },
        {
          header: "Last used",
          cell: (secret) => (secret.lastUsedAt ? new Date(secret.lastUsedAt).toLocaleString() : "—"),
        },
      ]}
    />
  );
}
