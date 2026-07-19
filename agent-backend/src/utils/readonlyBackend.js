/**
 * Wrap a deepagents backend so read operations pass through but any mutation
 * returns a tool-visible error instead of writing. Used for the `/skills/`
 * route: skills are agent-level config shared by every user of the agent, so
 * chat sessions must never modify them (edits go through the skill CRUD
 * API / the Architect's `manage_skill` tool instead).
 */
export function readonlyBackend(backend, label = 'This directory') {
  return {
    ls: backend.ls.bind(backend),
    read: backend.read.bind(backend),
    readRaw: backend.readRaw.bind(backend),
    grep: backend.grep.bind(backend),
    glob: backend.glob.bind(backend),
    downloadFiles: backend.downloadFiles.bind(backend),
    write: async (filePath) => ({
      error: `${label} is read-only.`,
      path: filePath,
      filesUpdate: null,
    }),
    edit: async (filePath) => ({
      error: `${label} is read-only.`,
      path: filePath,
      filesUpdate: null,
      occurrences: 0,
    }),
    uploadFiles: async (files) =>
      files.map(([filePath]) => ({
        path: filePath,
        error: 'permission_denied',
      })),
  };
}
