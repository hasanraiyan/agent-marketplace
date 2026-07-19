/**
 * Rendering helpers for serving DB skills as Agent Skills (SKILL.md) virtual files.
 *
 * A skill is a folder: `<slug>/SKILL.md` (required) plus optional supporting
 * files (we serve `codeSnippets` as sibling files). Paths use POSIX slashes and
 * are relative to the skills route root.
 */

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
 * Sanitize a supporting-file name into a single path segment.
 * Rejects traversal and separators; returns null for unusable names.
 */
export function sanitizeSkillFilename(filename) {
  const cleaned = String(filename || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('..') || cleaned.includes('\0') || cleaned.includes('~')) {
    return null;
  }
  // Keep at most one directory level (per Agent Skills spec references stay shallow)
  const parts = cleaned.split('/').filter(Boolean).slice(0, 2);
  if (parts.length === 0) return null;
  return parts.join('/');
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

  for (const snippet of skill.codeSnippets || []) {
    const filename = sanitizeSkillFilename(snippet.filename);
    if (!filename || filename.toUpperCase() === 'SKILL.MD') continue;
    files[`/${slug}/${filename}`] = {
      content: String(snippet.code ?? ''),
      created_at: createdAt,
      modified_at: modifiedAt,
      mimeType: 'text/plain',
    };
  }

  return files;
}
