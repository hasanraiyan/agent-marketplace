"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { AgentForm } from "@/components/agents/agent-form";

export default function EditAgentPage() {
  const { projectId, agentId } = useParams<{ projectId: string; agentId: string }>();
  return <AgentForm projectId={projectId} agentId={agentId} />;
}
