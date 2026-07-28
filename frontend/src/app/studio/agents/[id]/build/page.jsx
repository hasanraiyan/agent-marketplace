"use client";

import { use } from "react";
import { AgentBuilderPage } from "@/components/agents/agent-builder-page";
import { StudioAgentTabs } from "@/components/studio/studio-agent-tabs";
import { studioRoutes } from "@/lib/studio-routes";

export default function Page({ params }) {
  const { id } = use(params);
  return (
    <AgentBuilderPage
      mode="edit"
      agentId={id}
      basePath={studioRoutes.agents}
      backLabel="Agents"
      runSegment="test"
      workspaceNav={<StudioAgentTabs agentId={id} active="build" />}
    />
  );
}
