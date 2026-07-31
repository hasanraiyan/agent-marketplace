"use client";

import ProjectAgentEditorPage from "../[agentId]/edit/page.jsx";

/**
 * Thin wrapper delegating to the shared editor with a synthetic
 * agentId="new" — same pattern as providers/skills/mcps new/page.jsx.
 */
export default function NewProjectAgentPage({ params: paramsPromise }) {
  const wrappedParams = paramsPromise.then((p) => ({ ...p, agentId: "new" }));
  return <ProjectAgentEditorPage params={wrappedParams} />;
}
