import { getConfig } from '@langchain/langgraph';
import fileService from './file.service.js';

/**
 * deepagents backend for the agent's read-only `/uploads/` folder: the images
 * the user attached in the current thread (see agui/userContent.js). Mounted
 * in agent.factory.js when the Agent has `imageInputEnabled`, wrapped in
 * readonlyBackend.
 *
 * The compiled agent is cached per agent + identity and shared across that
 * user's threads, so the thread is read per call from the LangGraph run
 * config (`configurable.thread_id`), never fixed at build time. Files are
 * listed by the thread they were attached in (`threadKeys`), which is only
 * ever set after the ownership check at ingestion.
 *
 * Reading a file returns its bytes with an image MIME type, so deepagents'
 * read_file hands the model an image block (≤10 MB, its own limit).
 * Keys look like `/<fileId>-<name>`.
 */

function safeName(name) {
  const cleaned = String(name || 'image')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned || 'image').slice(0, 80);
}

export function attachmentKey(file) {
  return `/${String(file._id)}-${safeName(file.originalName)}`;
}

function globToRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*';
        i++;
        if (pattern[i + 1] === '/') i++;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

export function createAttachmentsBackend({ files = fileService, getThreadKey } = {}) {
  const threadKey =
    getThreadKey ||
    (() => {
      try {
        return getConfig()?.configurable?.thread_id;
      } catch {
        return undefined;
      }
    });

  async function list() {
    const key = threadKey();
    if (!key) return [];
    return await files.listThreadAttachments(key);
  }

  const info = (file) => ({
    path: attachmentKey(file),
    is_dir: false,
    size: file.size,
    modified_at: new Date(file.createdAt || Date.now()).toISOString(),
  });

  async function find(filePath) {
    const all = await list();
    return all.find((file) => attachmentKey(file) === filePath) || null;
  }

  async function readRaw(filePath) {
    const file = await find(filePath);
    if (!file) return { error: `File '${filePath}' not found` };
    try {
      const bytes = await files.readFileBytes(file);
      const stamp = new Date(file.createdAt || Date.now()).toISOString();
      return {
        data: {
          content: new Uint8Array(bytes),
          mimeType: file.mimeType,
          created_at: stamp,
          modified_at: stamp,
        },
      };
    } catch {
      return { error: `File '${filePath}' is no longer available` };
    }
  }

  return {
    async ls(path = '/') {
      if (path !== '/' && path !== '') return { files: [] };
      return { files: (await list()).map(info) };
    },
    async read(filePath) {
      const result = await readRaw(filePath);
      if (result.error) return { error: result.error };
      return { content: result.data.content, mimeType: result.data.mimeType };
    },
    readRaw,
    // Images have no text to search.
    async grep() {
      return { matches: [] };
    },
    async glob(pattern, path = '/') {
      const base = path.endsWith('/') ? path : `${path}/`;
      const re = globToRegExp(pattern.startsWith('/') ? pattern : `${base}${pattern}`);
      const matched = (await list()).filter((file) => re.test(attachmentKey(file)));
      return { files: matched.map(info) };
    },
    async downloadFiles(paths) {
      const out = [];
      for (const p of paths) {
        const result = await readRaw(p);
        out.push(
          result.error
            ? { path: p, content: null, error: 'file_not_found' }
            : { path: p, content: result.data.content, error: null }
        );
      }
      return out;
    },
    // Replaced by readonlyBackend; present so the object is a full backend.
    async write(filePath) {
      return { error: '/uploads/ is read-only.', path: filePath, filesUpdate: null };
    },
    async edit(filePath) {
      return {
        error: '/uploads/ is read-only.',
        path: filePath,
        filesUpdate: null,
        occurrences: 0,
      };
    },
    async uploadFiles(list_) {
      return list_.map(([p]) => ({ path: p, error: 'permission_denied' }));
    },
  };
}
