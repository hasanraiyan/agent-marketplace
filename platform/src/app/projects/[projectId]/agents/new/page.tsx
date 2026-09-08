"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { AgentForm } from "@/components/agents/agent-form";

export default function NewAgentPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <AgentForm projectId={projectId} />;
}
