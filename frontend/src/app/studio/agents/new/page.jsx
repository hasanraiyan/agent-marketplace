import { AgentBuilderPage } from "@/components/agents/agent-builder-page";
import { studioRoutes } from "@/lib/studio-routes";

// Same builder the dashboard create flow uses — only the surrounding routes
// differ, so there is one implementation of agent creation.
//
// No workspace nav here: the agent does not exist yet, so Overview/Test have
// nothing to point at.
export default function Page() {
  return (
    <AgentBuilderPage
      mode="create"
      basePath={studioRoutes.agents}
      backLabel="Agents"
      runSegment="test"
    />
  );
}
