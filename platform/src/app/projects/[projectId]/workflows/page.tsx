"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { TreeStructureIcon, PlayIcon, ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectWorkflows } from "@/lib/api/projects";

interface Workflow {
  _id: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  publishedVersion: number;
  draft?: {
    nodes?: Array<{ id: string; type: string }>;
    edges?: Array<{ id: string }>;
  };
  updatedAt?: string;
}

export default function WorkflowsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ResourceListPage<Workflow>
      title="Workflows"
      description="Multi-agent pipelines, deterministic tool chains, and LangGraph orchestration."
      icon={TreeStructureIcon}
      fetchItems={() => getProjectWorkflows(projectId)}
      cacheKey={`GET /projects/${projectId}/workflows`}
      newHref={`/projects/${projectId}/workflows/new`}
      getRowHref={(wf) => `/projects/${projectId}/workflows/${wf._id}`}
      emptyDescription="Create your first multi-agent workflow to connect agents, knowledge, and tools."
      columns={[
        {
          header: "Name",
          cell: (wf) => (
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{wf.name}</span>
              {wf.publishedVersion > 0 ? (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
                  v{wf.publishedVersion}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono text-muted-foreground">
                  Draft
                </Badge>
              )}
            </div>
          ),
        },
        {
          header: "Description",
          cell: (wf) => (
            <span className="text-muted-foreground text-sm line-clamp-1">
              {wf.description || "—"}
            </span>
          ),
        },
        {
          header: "Graph Shape",
          cell: (wf) => {
            const count = wf.draft?.nodes?.length || 0;
            return (
              <span className="text-xs text-muted-foreground">
                {count} {count === 1 ? "node" : "nodes"}
              </span>
            );
          },
        },
        {
          header: "",
          className: "w-44 text-right shrink-0",
          cell: (wf) => (
            <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                render={<Link href={`/projects/${projectId}/workflows/${wf._id}/runs`} />}
              >
                <ClockCounterClockwiseIcon className="size-3.5 text-muted-foreground" />
                <span>Runs</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-2.5 text-xs hover:border-primary/40 hover:bg-primary/5"
                render={<Link href={`/projects/${projectId}/workflows/${wf._id}`} />}
              >
                <TreeStructureIcon className="size-3 text-primary" weight="bold" />
                <span>Canvas</span>
              </Button>
            </div>
          ),
        },
      ]}
    />
  );
}
