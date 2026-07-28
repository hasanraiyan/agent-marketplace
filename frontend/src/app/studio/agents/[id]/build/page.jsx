"use client";

import { use } from "react";
import { AgentBuilderPage } from "@/components/agents/agent-builder-page";

export default function Page({ params }) {
  const { id } = use(params);
  return (
    <AgentBuilderPage
      mode="edit"
      agentId={id}
      basePath="/studio/agents"
      backLabel="Agents"
      runSegment="test"
    />
  );
}
