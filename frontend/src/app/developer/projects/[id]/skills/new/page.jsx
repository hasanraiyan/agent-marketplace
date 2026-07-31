"use client";

import ProjectSkillEditorPage from "../[skillId]/edit/page.jsx";

/**
 * Thin wrapper delegating to the shared editor with a synthetic
 * skillId="new" — same pattern as providers/new/page.jsx.
 */
export default function NewProjectSkillPage({ params: paramsPromise }) {
  const wrappedParams = paramsPromise.then((p) => ({ ...p, skillId: "new" }));
  return <ProjectSkillEditorPage params={wrappedParams} />;
}
