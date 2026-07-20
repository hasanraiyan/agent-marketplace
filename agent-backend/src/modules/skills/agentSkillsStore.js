import mongoose from 'mongoose';
import { BaseStore } from '@langchain/langgraph';
import Agent from '../agents/agent.model.js';
import { buildSkillFiles } from './skillMarkdown.js';
import loggerService from '../../utils/logger/index.js';

const logger = loggerService.getLogger();

/**
 * Read-only BaseStore facade that serves an agent's attached skills as virtual
 * files, live from the Skill collection — no mirroring or sync step.
 *
 * Namespace convention: ['agents', <agentId>, 'enabled'].
 * Keys are file paths with a leading slash, e.g. '/my-skill/SKILL.md'
 * (deepagents' StoreBackend passes the route-stripped file path as the key).
 *
 * The DB stays the single source of truth: skill CRUD in the UI/Architect is
 * immediately visible to the agent on its next filesystem operation.
 */
export class AgentSkillsStore extends BaseStore {
  /**
   * @param {Object} [options]
   * @param {Record<string, Record<string, string>>} [options.staticSkillFiles]
   *   Hardcoded skills for virtual agents (e.g. the Architect), keyed by
   *   agentId then by file path: { [agentId]: { '/dir/SKILL.md': content } }.
   */
  constructor({ staticSkillFiles = {} } = {}) {
    super();
    this.staticSkillFiles = staticSkillFiles;
  }

  /** Resolve all virtual skill files for an agent as [path, fileValue] pairs. */
  async _getFiles(agentId) {
    const files = new Map();
    const epoch = new Date(0).toISOString();

    const staticFiles = this.staticSkillFiles[agentId];
    for (const [path, content] of Object.entries(staticFiles || {})) {
      files.set(path, {
        content,
        created_at: epoch,
        modified_at: epoch,
        mimeType: 'text/markdown',
      });
    }

    // Agents with static skills are virtual (no DB document) — e.g. the
    // Architect, whose pseudo-id would otherwise pass ObjectId validation.
    if (!staticFiles && mongoose.Types.ObjectId.isValid(agentId)) {
      const agent = await Agent.findById(agentId).populate('skills');
      for (const skill of agent?.skills || []) {
        for (const [path, value] of Object.entries(buildSkillFiles(skill))) {
          files.set(path, value);
        }
      }
    }

    return files;
  }

  _agentIdFromNamespace(namespace) {
    // ['agents', <agentId>, 'enabled'] — tolerate shorter shapes defensively.
    if (!Array.isArray(namespace) || namespace[0] !== 'agents') return null;
    return namespace[1] || null;
  }

  async batch(operations) {
    const results = [];

    for (const op of operations) {
      if ('value' in op) {
        // PUT/DELETE — this store is read-only; the runtime additionally wraps
        // the backend in a read-only guard, so this is belt-and-braces.
        logger.warn('[AgentSkillsStore] write ignored (read-only)', {
          namespace: op.namespace,
          key: op.key,
        });
        results.push(null);
      } else if ('namespacePrefix' in op) {
        results.push(await this._search(op));
      } else if ('key' in op && 'namespace' in op) {
        results.push(await this._get(op));
      } else {
        // LIST NAMESPACES — not meaningful for this facade.
        results.push([]);
      }
    }

    return results;
  }

  async _get(op) {
    const agentId = this._agentIdFromNamespace(op.namespace);
    if (!agentId) return null;

    const files = await this._getFiles(agentId);
    const value = files.get(op.key);
    if (!value) return null;

    return {
      key: op.key,
      namespace: op.namespace,
      value,
      createdAt: new Date(value.created_at),
      updatedAt: new Date(value.modified_at),
    };
  }

  async _search(op) {
    const agentId = this._agentIdFromNamespace(op.namespacePrefix);
    if (!agentId) return [];

    const files = await this._getFiles(agentId);
    const items = [];
    for (const [key, value] of files.entries()) {
      items.push({
        key,
        namespace: op.namespacePrefix,
        value,
        createdAt: new Date(value.created_at),
        updatedAt: new Date(value.modified_at),
      });
    }

    // Stable ordering so StoreBackend's offset pagination never skips files.
    items.sort((a, b) => a.key.localeCompare(b.key));

    const offset = op.offset ?? 0;
    const limit = op.limit ?? items.length;
    return items.slice(offset, offset + limit);
  }
}
