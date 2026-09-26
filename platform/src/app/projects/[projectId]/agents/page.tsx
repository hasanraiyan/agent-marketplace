"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CodeIcon, PlayIcon, RobotIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ResourceListPage } from "@/components/resources/resource-list-page";
import { getProjectAgents } from "@/lib/api/projects";
import { AgentCodeDialog } from "@/components/agents/agent-code-dialog";

interface Agent {
  _id: string;
  name: string;
  description?: string;
}

export default function AgentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [codeTarget, setCodeTarget] = React.useState<Agent | null>(null);

  return (
    <>
      <ResourceListPage<Agent>
        title="Agents"
        description="The Agents this Project can run."
        icon={RobotIcon}
        fetchItems={() => getProjectAgents(projectId)}
        cacheKey={`GET /projects/${projectId}/agents`}
        newHref={`/projects/${projectId}/agents/new`}
        getRowHref={(agent) =>
          `/projects/${projectId}/agents/${agent._id}/edit`
        }
        emptyDescription="Create an Agent to start testing it in the Playground."
        columns={[
          {
            header: "Name",
            className: "w-[160px] sm:w-[220px] md:w-[260px] shrink-0 font-medium",
            cell: (agent) => (
              <span
                className="block truncate font-medium text-foreground"
                title={agent.name}
              >
                {agent.name}
              </span>
            ),
          },
          {
            header: "Description",
            className: "w-auto min-w-0",
            cell: (agent) => (
              <span
                className="block truncate text-xs text-muted-foreground"
                title={agent.description || ""}
              >
                {agent.description || "—"}
              </span>
            ),
          },
          {
            header: "",
            className: "w-36 text-right shrink-0",
            cell: (agent) => (
              <div
                className="flex items-center justify-end gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="View Code"
                  onClick={() => setCodeTarget(agent)}
                >
                  <CodeIcon className="size-3.5" />
                  <span className="sr-only">View Code</span>
                </Button>
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
                  <span>Test</span>
                </Button>
              </div>
            ),
          },
        ]}
      />

      {codeTarget && (
        <AgentCodeDialog
          open={!!codeTarget}
          onOpenChange={(open) => {
            if (!open) setCodeTarget(null);
          }}
          agentId={codeTarget._id}
          agentName={codeTarget.name}
          projectId={projectId}
        />
      )}
    </>
  );
}
