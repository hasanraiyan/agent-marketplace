"use client";

import ProjectRestToolSourceEditorPage from "../[sourceId]/edit/page.jsx";

/**
 * Thin wrapper delegating to the shared editor with a synthetic
 * sourceId="new" — same pattern as mcps/new/page.jsx.
 */
export default function NewProjectRestToolSourcePage({ params: paramsPromise }) {
  const wrappedParams = paramsPromise.then((p) => ({ ...p, sourceId: "new" }));
  return <ProjectRestToolSourceEditorPage params={wrappedParams} />;
}
