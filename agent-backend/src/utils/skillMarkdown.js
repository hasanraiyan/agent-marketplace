/**
 * Rendering helpers for serving DB skills as Agent Skills (SKILL.md) virtual files.
 *
 * A skill is a folder: `<slug>/SKILL.md` (required) plus optional supporting
 * files (we serve `codeSnippets` as sibling files). Paths use POSIX slashes and
 * are relative to the skills route root.
 */

import { normalizeSkillFilePath, mimeTypeForSkillPath } from './skillValidation.js';

/** ISO string from a Date, or the fallback when absent/invalid. */
function toIso(date, fallback) {
  return date instanceof Date ? date.toISOString() : fallback;
}

/**
 * Slugify a skill name into a safe directory segment.
 * The Skill model already enforces lowercase-hyphen names, but agent-attached
 * data can predate validation, so odd names must not break the path.
 */
export function slugifySkillName(name) {
  return (
    String(name)
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'skill'
  );
}

/**
 * Sanitize a supporting-file name into a safe relative path.
 * Rejects traversal; nested folders are allowed (references/, scripts/, …).
 * Returns null for unusable names.
 */
export function sanitizeSkillFilename(filename) {
  return normalizeSkillFilePath(String(filename || '').replace(/^\/+/, ''));
}

/**
 * Render a skill document to full SKILL.md content (frontmatter + instructions).
 * Frontmatter values are JSON-encoded: colons, quotes, and newlines in
 * free-text fields are invalid as plain YAML scalars.
 */
export function renderSkillMarkdown(skill, fallbackSlug) {
  const name = JSON.stringify(String(skill.name ?? fallbackSlug ?? 'skill'));
  const description = JSON.stringify(String(skill.description ?? ''));
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${skill.instructions ?? ''}`;
}

/**
 * Build the virtual file map for one skill document.
 * Returns entries of `{ [path]: { content, created_at, modified_at, mimeType } }`
 * where path is `/<slug>/SKILL.md` (+ `/<slug>/<snippet filename>`).
 */
export function buildSkillFiles(skill) {
  const files = {};
  const slug = slugifySkillName(skill.name);
  const createdAt = (skill.createdAt instanceof Date ? skill.createdAt : new Date()).toISOString();
  const modifiedAt = (skill.updatedAt instanceof Date ? skill.updatedAt : new Date()).toISOString();

  files[`/${slug}/SKILL.md`] = {
    content: renderSkillMarkdown(skill, slug),
    created_at: createdAt,
    modified_at: modifiedAt,
    mimeType: 'text/markdown',
  };

  // Bundled files (files[] is canonical; codeSnippets is the unmigrated
  // legacy shape and is only read when files[] is empty).
  const bundled =
    skill.files?.length > 0
      ? skill.files.map((f) => ({ ...f, filename: f.path, code: f.content }))
      : (skill.codeSnippets || []).map((s) => ({ ...s }));

  for (const entry of bundled) {
    const filename = sanitizeSkillFilename(entry.filename);
    if (!filename || filename.toUpperCase() === 'SKILL.MD') continue;
    files[`/${slug}/${filename}`] = {
      content: String(entry.code ?? ''),
      created_at: toIso(entry.createdAt, createdAt),
      modified_at: toIso(entry.updatedAt, modifiedAt),
      mimeType: entry.mimeType || mimeTypeForSkillPath(filename),
    };
  }

  return files;
}
