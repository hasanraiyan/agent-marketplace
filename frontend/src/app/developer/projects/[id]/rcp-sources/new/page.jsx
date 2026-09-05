"use client";

import ProjectRcpSourceEditorPage from "../[sourceId]/edit/page.jsx";

/**
 * Thin wrapper delegating to the shared editor with a synthetic
 * sourceId="new" — same pattern as rest-tool-sources/new/page.jsx.
 */
export default function NewProjectRcpSourcePage({ params: paramsPromise }) {
  const wrappedParams = paramsPromise.then((p) => ({ ...p, sourceId: "new" }));
  return <ProjectRcpSourceEditorPage params={wrappedParams} />;
}
