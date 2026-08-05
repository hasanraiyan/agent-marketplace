"use client";

import ProjectStoreEditorPage from "../[storeId]/edit/page.jsx";

/**
 * Thin wrapper delegating to the shared editor with a synthetic
 * storeId="new" — same pattern as skills/new/page.jsx.
 */
export default function NewProjectStorePage({ params: paramsPromise }) {
  const wrappedParams = paramsPromise.then((p) => ({ ...p, storeId: "new" }));
  return <ProjectStoreEditorPage params={wrappedParams} />;
}
