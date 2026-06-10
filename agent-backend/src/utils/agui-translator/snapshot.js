// deepagents StateBackend stores each file's body as an array of lines (it splits
// on '\n' when writing); it can also be a plain string, or a Uint8Array for binary
// writes. Normalize to a single display string. Binary content is not surfaced as
// text — the panel can still show its existence/size.
export function normalizeFileContent(data) {
  const body = data && typeof data === 'object' && 'content' in data ? data.content : data;
  if (Array.isArray(body)) return body.join('\n');
  if (typeof body === 'string') return body;
  return '';
}

/**
 * Build the AG-UI state payload mirrored to the client (the virtual filesystem +
 * the live plan). Reads the graph's persisted channel values (`getState().values`)
 * and shapes them for the Files panel / todo checklist.
 *
 * System-seeded skill files (`/skills/...`) are excluded — they are injected by the
 * factory, not artifacts the agent produced, so they would only be noise.
 *
 * @param {object} stateValues  LangGraph state snapshot `.values` ({ files, todos, ... }).
 * @returns {{ files: object, todos: Array }} normalized snapshot.
 */
export function buildFilesTodosSnapshot(stateValues) {
  const files = {};
  const rawFiles = stateValues?.files;
  if (rawFiles && typeof rawFiles === 'object') {
    for (const [path, data] of Object.entries(rawFiles)) {
      if (typeof path !== 'string' || path.startsWith('/skills/')) continue;
      // Filter out directory entries to avoid presenting them as empty files in the UI
      if (
        data?.is_dir === true ||
        data?.isDir === true ||
        data?.isDirectory === true ||
        data?.type === 'directory' ||
        path.endsWith('/')
      ) {
        continue;
      }
      const content = normalizeFileContent(data);
      files[path] = {
        content,
        size: content.length,
        created_at: data?.created_at ?? data?.createdAt ?? null,
        modified_at: data?.modified_at ?? data?.modifiedAt ?? null,
      };
    }
  }

  const todos = Array.isArray(stateValues?.todos)
    ? stateValues.todos.map((t) => ({
        content: typeof t?.content === 'string' ? t.content : '',
        status: typeof t?.status === 'string' ? t.status : 'pending',
      }))
    : [];

  return { files, todos };
}
