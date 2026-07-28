import { AgentBuilderPage } from "@/components/agents/agent-builder-page";

// Same builder the dashboard create flow uses — only the surrounding routes
// differ, so there is one implementation of agent creation.
export default function Page() {
  return (
    <AgentBuilderPage
      mode="create"
      basePath="/studio/agents"
      backLabel="Agents"
      runSegment="test"
    />
  );
}
