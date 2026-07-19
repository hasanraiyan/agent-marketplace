/**
 * Shared validation for multi-file skill bundles.
 *
 * A skill is a folder: SKILL.md (generated from name/description/instructions)
 * plus bundled supporting files under relative paths (references/, scripts/,
 * assets/ by convention — any safe relative path is accepted). Limits follow
 * the Anthropic Agent Skills spec guidance.
 */

export const SKILL_LIMITS = {
  MAX_FILE_COUNT: 50,
  MAX_FILE_BYTES: 200_000,
  MAX_TOTAL_BYTES: 1_000_000,
  MAX_PATH_LENGTH: 256,
  MAX_SKILL_MD_LINES: 500,
};

/**
 * Normalize a bundled-file path to a safe, relative POSIX path.
 * Returns null when the path is unusable (absolute, traversal, empty).
 */
export function normalizeSkillFilePath(rawPath) {
  const path = String(rawPath ?? '')
    .trim()
    .replace(/\\/g, '/');
  if (!path || path.length > SKILL_LIMITS.MAX_PATH_LENGTH) return null;
  if (path.startsWith('/') || /^[a-zA-Z]:\//.test(path)) return null;

  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  for (const part of parts) {
    if (part === '.' || part === '..' || part === '~' || part.includes('\0')) return null;
  }
  return parts.join('/');
}

/** Rough mime-type from a file extension, for serving bundled files. */
export function mimeTypeForSkillPath(path) {
  const ext = String(path).toLowerCase().split('.').pop();
  const map = {
    md: 'text/markdown',
    markdown: 'text/markdown',
    json: 'application/json',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    html: 'text/html',
    css: 'text/css',
    csv: 'text/csv',
    txt: 'text/plain',
    py: 'text/x-python',
    js: 'text/javascript',
    ts: 'text/typescript',
    sh: 'text/x-shellscript',
  };
  return map[ext] || 'text/plain';
}

/**
 * Validate and normalize a skill's bundled files.
 *
 * @param {Array<{path?: string, filename?: string, content?: string, code?: string, mimeType?: string}>} files
 * @param {{ instructions?: string }} [context] used for the total-size budget
 * @returns {{ files: Array<{path, content, mimeType}>, errors: string[], warnings: string[] }}
 */
export function validateSkillFiles(files = [], context = {}) {
  const errors = [];
  const warnings = [];
  const normalized = [];
  const seen = new Set();
  let totalBytes = Buffer.byteLength(String(context.instructions ?? ''), 'utf8');

  for (const file of files) {
    const rawPath = file.path ?? file.filename;
    const path = normalizeSkillFilePath(rawPath);
    if (!path) {
      errors.push(`Invalid skill file path: ${String(rawPath)}`);
      continue;
    }
    if (path.toUpperCase() === 'SKILL.MD') {
      errors.push('SKILL.md is generated from the skill instructions — do not bundle it as a file.');
      continue;
    }
    if (seen.has(path)) {
      errors.push(`Duplicate skill file path: ${path}`);
      continue;
    }
    seen.add(path);

    const content = String(file.content ?? file.code ?? '');
    const byteLength = Buffer.byteLength(content, 'utf8');
    if (byteLength > SKILL_LIMITS.MAX_FILE_BYTES) {
      errors.push(`Skill file too large (${path}); max ${SKILL_LIMITS.MAX_FILE_BYTES} bytes.`);
      continue;
    }
    totalBytes += byteLength;

    const topLevel = path.split('/')[0];
    if (path.includes('/') && !['references', 'scripts', 'assets', 'agents'].includes(topLevel)) {
      warnings.push(
        `Convention: bundled files usually live under references/, scripts/, or assets/ (got ${path}).`
      );
    }

    normalized.push({
      path,
      content,
      mimeType: file.mimeType || mimeTypeForSkillPath(path),
    });
  }

  if (normalized.length + 1 > SKILL_LIMITS.MAX_FILE_COUNT) {
    errors.push(`Skill has too many files; max ${SKILL_LIMITS.MAX_FILE_COUNT}.`);
  }
  if (totalBytes > SKILL_LIMITS.MAX_TOTAL_BYTES) {
    errors.push(`Skill bundle is too large; max ${SKILL_LIMITS.MAX_TOTAL_BYTES} bytes total.`);
  }

  const instructionLines = String(context.instructions ?? '').split(/\r?\n/).length;
  if (instructionLines > SKILL_LIMITS.MAX_SKILL_MD_LINES) {
    warnings.push(
      `SKILL.md has ${instructionLines} lines; keep it under ${SKILL_LIMITS.MAX_SKILL_MD_LINES} — move detail into references/ files.`
    );
  }

  return { files: normalized, errors, warnings };
}
