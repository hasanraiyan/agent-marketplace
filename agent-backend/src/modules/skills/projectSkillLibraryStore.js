import { BaseStore } from '@langchain/langgraph';
import Skill from './skill.model.js';
import { buildSkillFiles, slugifySkillName } from './skillMarkdown.js';
import { SKILL_LIMITS, mimeTypeForSkillPath } from './skillValidation.js';
import { parseSkillLibraryKey, parseSkillMdContent } from './skillLibraryStore.js';

/**
 * Project-scoped sibling of `SkillLibraryStore` (blueprint Phase 11.5,
 * skill-library parity follow-up) — the Project Agent Architect's own
 * `/skill-library/` mount, backed by Project-owned Skills instead of a
 * Persona User's own. A deliberate new class, not a generalization of
 * `SkillLibraryStore` itself: same reasoning as PR-62's
 * `projectBuilder.tools.js` vs. `builder.tools.js` — the live Persona
 * Architect's own store stays completely untouched.
 *
 * Reuses every ownership-agnostic piece of the Persona store unchanged:
 * `buildSkillFiles`/`slugifySkillName` (skillMarkdown.js),
 * `SKILL_LIMITS`/`mimeTypeForSkillPath` (skillValidation.js), and
 * `parseSkillLibraryKey`/`parseSkillMdContent` (imported directly from
 * skillLibraryStore.js — pure path/frontmatter parsers, no ownership
 * coupling at all). Only the ownership queries below differ: `{ domain,
 * ownerType: 'Project' }` instead of `{ ownerId: userId }`, the exact
 * field shape `ownerFieldsForContext(context)` already produces for a
 * `ProjectAdminContext` elsewhere in this codebase (PR-60's Skill CRUD).
 *
 * Namespace convention: ['projects', <domain>, 'skill-library'].
 */

const putQueues = new Map();

export class ProjectSkillLibraryStore extends BaseStore {
  _domainFromNamespace(namespace) {
    // ['projects', <domain>, 'skill-library'] — tolerate shorter shapes.
    if (!Array.isArray(namespace) || namespace[0] !== 'projects') return null;
    return namespace[1] || null;
  }

  _contentToString(content) {
    if (Array.isArray(content)) return content.join('\n');
    if (typeof content === 'string') return content;
    if (content instanceof Uint8Array) return Buffer.from(content).toString('utf8');
    return '';
  }

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
        results.push([]);
      }
    }

    return results;
  }

  /** All this Project's skills rendered to a { path → FileData } map. */
  async _getFiles(domain) {
    const files = new Map();
    const skills = await Skill.find({ domain, ownerType: 'Project' });
    for (const skill of skills) {
      for (const [path, value] of Object.entries(buildSkillFiles(skill))) {
        files.set(path, value);
      }
    }
    return files;
  }

  async _findSkill(domain, skillName) {
    const direct = await Skill.findOne({ domain, ownerType: 'Project', name: skillName });
    if (direct) return direct;
    const all = await Skill.find({ domain, ownerType: 'Project' });
    return all.find((s) => slugifySkillName(s.name) === skillName) || null;
  }

  async _get(op) {
    const domain = this._domainFromNamespace(op.namespace);
    if (!domain) return null;

    let parsed;
    try {
      parsed = parseSkillLibraryKey(op.key);
    } catch {
      return null;
    }

    const skill = await this._findSkill(domain, parsed.skillName);
    if (!skill) return null;

    const files = buildSkillFiles(skill);
    const key = `/${slugifySkillName(skill.name)}/${parsed.relativePath}`;
    const value = files[key];
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
    const domain = this._domainFromNamespace(op.namespacePrefix);
    if (!domain) return [];

    const files = await this._getFiles(domain);
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

  async _put(op) {
    const domain = this._domainFromNamespace(op.namespace);
    if (!domain) throw new Error('Skill library writes require a Project domain namespace.');
    // Same reasoning as SkillLibraryStore: the Architect often issues
    // several write_file calls in parallel; serialize writes per domain to
    // avoid Mongoose's optimistic-concurrency check (VersionError).
    return this._enqueuePut(String(domain), () => this._putNow(domain, op));
  }

  _enqueuePut(domain, fn) {
    const prev = putQueues.get(domain) ?? Promise.resolve();
    const run = prev.then(fn);
    const tail = run.then(
      () => {},
      () => {}
    );
    putQueues.set(domain, tail);
    tail.then(() => {
      if (putQueues.get(domain) === tail) putQueues.delete(domain);
    });
    return run;
  }

  async _putNow(domain, op, isRetry = false) {
    const { skillName, relativePath, isSkillMd } = parseSkillLibraryKey(op.key);
    try {
      const skill = await this._findSkill(domain, skillName);

      if (op.value === null) {
        return await this._deleteFile(skill, skillName, relativePath, isSkillMd);
      }

      const content = this._contentToString(op.value.content);
      if (isSkillMd) {
        return await this._writeSkillMd(domain, skill, skillName, content);
      }
      return await this._writeSupportingFile(
        skill,
        skillName,
        relativePath,
        content,
        op.value.mimeType
      );
    } catch (err) {
      if (err?.name === 'VersionError' && !isRetry) {
        return this._putNow(domain, op, true);
      }
      throw err;
    }
  }

  async _writeSkillMd(domain, skill, skillName, content) {
    const { metadata, body } = parseSkillMdContent(content);

    if (metadata?.name && metadata.name !== skillName) {
      throw new Error(
        `SKILL.md frontmatter name ('${metadata.name}') must match the folder name ('${skillName}').`
      );
    }

    const instructions = (metadata ? body : content).trim();
    if (instructions.length < 10) {
      throw new Error('SKILL.md needs a meaningful instructions body (at least 10 characters).');
    }
    if (instructions.length > 50000) {
      throw new Error('SKILL.md instructions exceed the 50,000 character limit.');
    }

    const description = metadata?.description ?? skill?.description;
    if (!description || description.length < 10) {
      throw new Error(
        'SKILL.md must start with YAML frontmatter including a description of at least 10 characters:\n---\nname: ' +
          skillName +
          '\ndescription: What this skill does and when to use it.\n---'
      );
    }
    if (description.length > 1024) {
      throw new Error('Skill description must be 1024 characters or fewer.');
    }

    if (skill) {
      skill.description = description;
      skill.instructions = instructions;
      await skill.save();
    } else {
      await Skill.create({
        domain,
        ownerType: 'Project',
        name: skillName,
        description,
        instructions,
        isPublic: false,
      });
    }
  }

  async _writeSupportingFile(skill, skillName, relativePath, content, mimeType) {
    if (!skill) {
      throw new Error(
        `Skill '${skillName}' does not exist yet — create /${skillName}/SKILL.md first.`
      );
    }

    const byteLength = Buffer.byteLength(content, 'utf8');
    if (byteLength > SKILL_LIMITS.MAX_FILE_BYTES) {
      throw new Error(`Skill file too large; max ${SKILL_LIMITS.MAX_FILE_BYTES} bytes.`);
    }

    const files = skill.files || [];
    const existing = files.find((f) => f.path === relativePath);
    if (existing) {
      existing.content = content;
      existing.mimeType = mimeType || mimeTypeForSkillPath(relativePath);
      existing.updatedAt = new Date();
    } else {
      if (files.length + 1 >= SKILL_LIMITS.MAX_FILE_COUNT) {
        throw new Error(`Skill has too many files; max ${SKILL_LIMITS.MAX_FILE_COUNT}.`);
      }
      files.push({
        path: relativePath,
        content,
        mimeType: mimeType || mimeTypeForSkillPath(relativePath),
      });
    }

    const totalBytes = files.reduce(
      (sum, f) => sum + Buffer.byteLength(String(f.content ?? ''), 'utf8'),
      Buffer.byteLength(String(skill.instructions ?? ''), 'utf8')
    );
    if (totalBytes > SKILL_LIMITS.MAX_TOTAL_BYTES) {
      throw new Error(
        `Skill bundle is too large; max ${SKILL_LIMITS.MAX_TOTAL_BYTES} bytes total.`
      );
    }

    skill.files = files;
    await skill.save();
  }

  async _deleteFile(skill, skillName, relativePath, isSkillMd) {
    if (!skill) return;
    if (isSkillMd) {
      throw new Error(
        'SKILL.md cannot be deleted from the filesystem — delete the whole skill with the manage_skill tool.'
      );
    }
    skill.files = (skill.files || []).filter((f) => f.path !== relativePath);
    await skill.save();
  }
}

export const projectSkillLibraryStore = new ProjectSkillLibraryStore();

export function projectSkillLibraryNamespace(domain) {
  return ['projects', String(domain), 'skill-library'];
}
