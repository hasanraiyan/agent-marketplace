"use client";

import ProjectRestToolEditorPage from "../[toolId]/edit/page.jsx";

/**
 * Thin wrapper delegating to the shared editor with a synthetic
 * toolId="new" — same pattern as mcps/new/page.jsx.
 */
export default function NewProjectRestToolPage({ params: paramsPromise }) {
  const wrappedParams = paramsPromise.then((p) => ({ ...p, toolId: "new" }));
  return <ProjectRestToolEditorPage params={wrappedParams} />;
}
