"use client";

import ProjectProviderEditorPage from "../[providerId]/edit/page.jsx";

/**
 * Thin wrapper delegating to the shared editor with a synthetic
 * providerId="new" — same pattern as
 * studio/(resources)/providers/new/page.jsx, but this route also inherits
 * the parent's [id] (project id) param, so it's forwarded through rather
 * than only synthesizing providerId.
 */
export default function NewProjectProviderPage({ params: paramsPromise }) {
  const wrappedParams = paramsPromise.then((p) => ({
    ...p,
    providerId: "new",
  }));
  return <ProjectProviderEditorPage params={wrappedParams} />;
}
