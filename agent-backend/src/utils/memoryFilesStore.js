import { BaseStore } from '@langchain/langgraph';
import MemoryFile from '../models/MemoryFile.js';

/**
 * BaseStore over the `memoryfiles` collection: one document per virtual memory
 * file (dostify-style file-based memory, replacing the old key-value pairs).
 *
 * Used by deepagents' StoreBackend for the `/memories/user/` and
 * `/memories/agent/` routes, and by the memory REST API for the UI.
 *
 * Keys are file paths with a leading slash ('/index.md'). Values follow
 * deepagents' FileData store shape: { content, mimeType, created_at, modified_at }.
 */

/** Validate/normalize a memory file path. Throws on traversal attempts. */
export function normalizeMemoryKey(rawKey) {
  const cleaned = String(rawKey ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length === 0) throw new Error('Memory file path is required');
  if (parts.some((p) => p === '.' || p === '..' || p.includes('\0') || p === '~')) {
    throw new Error(`Invalid memory file path: ${rawKey}`);
  }
  return `/${parts.join('/')}`;
}

export class MemoryFilesStore extends BaseStore {
  async batch(operations) {
    const results = [];

    for (const op of operations) {
      if ('value' in op) {
        await this._put(op);
        results.push(null);
      } else if ('namespacePrefix' in op) {
        results.push(await this._search(op));
      } else if ('key' in op && 'namespace' in op) {
        results.push(await this._get(op));
      } else {
        results.push(await this._listNamespaces(op));
      }
    }

    return results;
  }

  _toItem(doc, namespace) {
    return {
      key: doc.key,
      namespace: namespace ?? doc.namespace,
      value: {
        content: doc.content,
        mimeType: doc.mimeType,
        created_at: doc.createdAt.toISOString(),
        modified_at: doc.updatedAt.toISOString(),
      },
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  _contentToString(content) {
    if (Array.isArray(content)) return content.join('\n');
    if (typeof content === 'string') return content;
    if (content instanceof Uint8Array) return Buffer.from(content).toString('utf8');
    return '';
  }

  async _get(op) {
    const key = normalizeMemoryKey(op.key);
    const doc = await MemoryFile.findOne({ namespace: op.namespace, key });
    return doc ? this._toItem(doc, op.namespace) : null;
  }

  async _put(op) {
    const key = normalizeMemoryKey(op.key);

    if (op.value === null) {
      await MemoryFile.deleteOne({ namespace: op.namespace, key });
      return;
    }

    await MemoryFile.findOneAndUpdate(
      { namespace: op.namespace, key },
      {
        $set: {
          content: this._contentToString(op.value.content),
          mimeType: op.value.mimeType || 'text/markdown',
        },
      },
      { upsert: true, new: true }
    );
  }

  async _search(op) {
    // Prefix match on the namespace array (exact elements, any deeper suffix).
    const query = {};
    (op.namespacePrefix || []).forEach((part, idx) => {
      query[`namespace.${idx}`] = part;
    });

    // Stable sort so StoreBackend's offset pagination never skips/duplicates.
    let cursor = MemoryFile.find(query).sort({ key: 1, _id: 1 });
    if (op.offset) cursor = cursor.skip(op.offset);
    if (op.limit !== undefined) cursor = cursor.limit(op.limit);

    const docs = await cursor.exec();
    const q = op.query?.trim().toLowerCase();
    return docs
      .filter(
        (doc) => !q || doc.key.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q)
      )
      .map((doc) => this._toItem(doc));
  }

  async _listNamespaces(op) {
    // `distinct` on an array field flattens values, so scan docs for the
    // accurate namespace arrays instead.
    const docs = await MemoryFile.find({}, 'namespace').lean();
    const seen = new Set();
    let namespaces = [];
    for (const doc of docs) {
      const ns = doc.namespace;
      const sig = JSON.stringify(ns);
      if (!seen.has(sig)) {
        seen.add(sig);
        namespaces.push(ns);
      }
    }

    if (op.matchConditions?.length) {
      namespaces = namespaces.filter((ns) =>
        op.matchConditions.every((cond) => {
          const pattern = cond.path;
          const source =
            cond.matchType === 'suffix' ? ns.slice(-pattern.length) : ns.slice(0, pattern.length);
          if (source.length < pattern.length) return false;
          return pattern.every((part, i) => part === '*' || source[i] === part);
        })
      );
    }

    if (op.maxDepth !== undefined) {
      const truncated = new Set(namespaces.map((ns) => JSON.stringify(ns.slice(0, op.maxDepth))));
      namespaces = Array.from(truncated).map((sig) => JSON.parse(sig));
    }

    namespaces.sort((a, b) => a.join('/').localeCompare(b.join('/')));
    const offset = op.offset ?? 0;
    const limit = op.limit ?? namespaces.length;
    return namespaces.slice(offset, offset + limit);
  }
}

export const memoryFilesStore = new MemoryFilesStore();

/** Namespace helpers shared by the agent runtime, REST API, and migration. */
export function userMemoryNamespace(userId) {
  return ['users', String(userId)];
}

export function agentMemoryNamespace(userId, agentId) {
  return ['users', String(userId), 'agents', String(agentId)];
}
