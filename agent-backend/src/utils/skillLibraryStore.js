import { BaseStore } from '@langchain/langgraph';
import Skill from '../models/Skill.js';
import { buildSkillFiles, slugifySkillName } from './skillMarkdown.js';
import {
  SKILL_LIMITS,
  normalizeSkillFilePath,
  mimeTypeForSkillPath,
} from './skillValidation.js';

/**
 * Writable BaseStore facade over the user's whole skill library, used by the
 * Architect's `/skill-library/` route. The Architect authors skills with its
 * ordinary filesystem tools:
 *
 *   write_file /skill-library/pdf-tools/SKILL.md        → upserts the Skill doc
 *   write_file /skill-library/pdf-tools/references/x.md → upserts into files[]
 *   edit_file  /skill-library/pdf-tools/SKILL.md        → incremental refinement
 *
 * Namespace convention: ['users', <userId>, 'skill-library'].
 * Keys are '/<skill-name>/<relative path>'; the first segment is the skill's
 * name (folder = name, per the Agent Skills spec). SKILL.md content carries
 * YAML frontmatter (name, description) followed by the instructions body.
 *
 * Skills are served to agents live from the DB, so no cache invalidation is
 * needed after writes.
 */

/** Parse '<skill>/<rest…>' out of a store key. Throws on unusable keys. */
export function parseSkillLibraryKey(rawKey) {
  const cleaned = normalizeSkillFilePath(String(rawKey ?? '').replace(/^\/+/, ''));
  if (!cleaned) throw new Error(`Invalid skill file path: ${rawKey}`);

  const [skillName, ...rest] = cleaned.split('/');
  if (!/^[a-z0-9-]{2,64}$/.test(skillName)) {
    throw new Error(
      `Skill folder name must be 2-64 lowercase letters, numbers, or hyphens (got '${skillName}').`
    );
  }
  if (rest.length === 0) {
    throw new Error(
      `Write files inside a skill folder, e.g. /${skillName}/SKILL.md — not the folder itself.`
    );
  }
  const relativePath = rest.join('/');
  const isSkillMd = relativePath.toUpperCase() === 'SKILL.MD';
  return { skillName, relativePath: isSkillMd ? 'SKILL.md' : relativePath, isSkillMd };
}

/**
 * Parse SKILL.md frontmatter. Values may be plain or JSON-encoded strings
 * (renderSkillMarkdown JSON-encodes them on the way out).
 */
export function parseSkillMdContent(content) {
  const text = String(content ?? '');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { metadata: null, body: text };

  const metadata = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      try {
        value = JSON.parse(value.replace(/^'(.*)'$/, '"$1"'));
      } catch {
        value = value.slice(1, -1);
      }
    }
    if (key === 'name' || key === 'description') metadata[key] = value;
  }
  return { metadata, body: text.slice(match[0].length).replace(/^\r?\n/, '') };
}

export class SkillLibraryStore extends BaseStore {
  _userIdFromNamespace(namespace) {
    // ['users', <userId>, 'skill-library'] — tolerate shorter shapes.
    if (!Array.isArray(namespace) || namespace[0] !== 'users') return null;
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

  /** All the user's skills rendered to a { path → FileData } map. */
  async _getFiles(userId) {
    const files = new Map();
    const skills = await Skill.find({ ownerId: userId });
    for (const skill of skills) {
      for (const [path, value] of Object.entries(buildSkillFiles(skill))) {
        files.set(path, value);
      }
    }
    return files;
  }

  async _findSkill(userId, skillName) {
    // name is enforced lowercase-hyphen, so folder name == skill name; fall
    // back to a slug match for any pre-validation documents.
    const direct = await Skill.findOne({ ownerId: userId, name: skillName });
    if (direct) return direct;
    const all = await Skill.find({ ownerId: userId });
    return all.find((s) => slugifySkillName(s.name) === skillName) || null;
  }

  async _get(op) {
    const userId = this._userIdFromNamespace(op.namespace);
    if (!userId) return null;

    let parsed;
    try {
      parsed = parseSkillLibraryKey(op.key);
    } catch {
      return null;
    }

    const skill = await this._findSkill(userId, parsed.skillName);
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
    const userId = this._userIdFromNamespace(op.namespacePrefix);
    if (!userId) return [];

    const files = await this._getFiles(userId);
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
    const userId = this._userIdFromNamespace(op.namespace);
    if (!userId) throw new Error('Skill library writes require a user namespace.');

    const { skillName, relativePath, isSkillMd } = parseSkillLibraryKey(op.key);
    const skill = await this._findSkill(userId, skillName);

    if (op.value === null) {
      return this._deleteFile(skill, skillName, relativePath, isSkillMd);
    }

    const content = this._contentToString(op.value.content);
    if (isSkillMd) {
      return this._writeSkillMd(userId, skill, skillName, content);
    }
    return this._writeSupportingFile(skill, skillName, relativePath, content, op.value.mimeType);
  }

  async _writeSkillMd(userId, skill, skillName, content) {
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
        ownerId: userId,
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
      throw new Error(`Skill bundle is too large; max ${SKILL_LIMITS.MAX_TOTAL_BYTES} bytes total.`);
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

export const skillLibraryStore = new SkillLibraryStore();

export function skillLibraryNamespace(userId) {
  return ['users', String(userId), 'skill-library'];
}
