"use client";

import ProjectMcpEditorPage from "../[mcpId]/edit/page.jsx";

/**
 * Thin wrapper delegating to the shared editor with a synthetic
 * mcpId="new" — same pattern as providers/new/page.jsx and
 * skills/new/page.jsx.
 */
export default function NewProjectMcpPage({ params: paramsPromise }) {
  const wrappedParams = paramsPromise.then((p) => ({ ...p, mcpId: "new" }));
  return <ProjectMcpEditorPage params={wrappedParams} />;
}
