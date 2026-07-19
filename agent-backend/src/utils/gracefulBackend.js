/**
 * Wrap a deepagents backend so mutation failures come back as tool-visible
 * `{ error }` results instead of thrown exceptions. A throw inside a file
 * tool fails the whole graph run and aborts every sibling parallel tool
 * call; returning `{ error }` lets the model read the message, fix its
 * mistake (wrong order, invalid path, over-limit file), and continue.
 * Used for the writable store routes (/skill-library/, /memories/*) whose
 * stores throw validation errors from put().
 */
export function gracefulBackend(backend) {
  return {
    ls: backend.ls.bind(backend),
    read: backend.read.bind(backend),
    readRaw: backend.readRaw.bind(backend),
    grep: backend.grep.bind(backend),
    glob: backend.glob.bind(backend),
    downloadFiles: backend.downloadFiles.bind(backend),
    write: async (filePath, content) => {
      try {
        return await backend.write(filePath, content);
      } catch (err) {
        return {
          error: String(err?.message ?? err),
          path: filePath,
          filesUpdate: null,
        };
      }
    },
    edit: async (filePath, oldString, newString, replaceAll) => {
      try {
        return await backend.edit(filePath, oldString, newString, replaceAll);
      } catch (err) {
        return {
          error: String(err?.message ?? err),
          path: filePath,
          filesUpdate: null,
          occurrences: 0,
        };
      }
    },
    uploadFiles: async (files) => {
      try {
        return await backend.uploadFiles(files);
      } catch (err) {
        return files.map(([filePath]) => ({
          path: filePath,
          error: String(err?.message ?? err),
        }));
      }
    },
  };
}
