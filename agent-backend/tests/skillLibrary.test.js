import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/models/Skill.js', () => ({
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

const Skill = (await import('../src/models/Skill.js')).default;
const {
  SKILL_LIMITS,
  normalizeSkillFilePath,
  mimeTypeForSkillPath,
  validateSkillFiles,
} = await import('../src/utils/skillValidation.js');
const {
  parseSkillLibraryKey,
  parseSkillMdContent,
  SkillLibraryStore,
  skillLibraryNamespace,
} = await import('../src/utils/skillLibraryStore.js');
const { buildSkillFiles } = await import('../src/utils/skillMarkdown.js');

describe('skillValidation', () => {
  describe('normalizeSkillFilePath', () => {
    test('normalizes safe relative paths', () => {
      expect(normalizeSkillFilePath('references/api.md')).toBe('references/api.md');
      expect(normalizeSkillFilePath('scripts\\run.py')).toBe('scripts/run.py');
      expect(normalizeSkillFilePath('a//b.md')).toBe('a/b.md');
      expect(normalizeSkillFilePath('  helper.py ')).toBe('helper.py');
    });

    test('rejects absolute paths and traversal', () => {
      expect(normalizeSkillFilePath('/etc/passwd')).toBeNull();
      expect(normalizeSkillFilePath('C:/windows/x')).toBeNull();
      expect(normalizeSkillFilePath('../escape.md')).toBeNull();
      expect(normalizeSkillFilePath('a/../b.md')).toBeNull();
      expect(normalizeSkillFilePath('~/home.md')).toBeNull();
      expect(normalizeSkillFilePath('')).toBeNull();
      expect(normalizeSkillFilePath('x'.repeat(300))).toBeNull();
    });
  });

  test('mimeTypeForSkillPath maps extensions with a plain-text fallback', () => {
    expect(mimeTypeForSkillPath('references/api.md')).toBe('text/markdown');
    expect(mimeTypeForSkillPath('scripts/run.py')).toBe('text/x-python');
    expect(mimeTypeForSkillPath('data.json')).toBe('application/json');
    expect(mimeTypeForSkillPath('unknown.xyz')).toBe('text/plain');
  });

  describe('validateSkillFiles', () => {
    test('normalizes files and accepts legacy filename/code keys', () => {
      const { files, errors } = validateSkillFiles([
        { path: 'references/api.md', content: '# API' },
        { filename: 'extract.py', code: 'print(1)' },
      ]);
      expect(errors).toEqual([]);
      expect(files).toEqual([
        { path: 'references/api.md', content: '# API', mimeType: 'text/markdown' },
        { path: 'extract.py', content: 'print(1)', mimeType: 'text/x-python' },
      ]);
    });

    test('rejects SKILL.md, duplicates, traversal, and oversized files', () => {
      const { errors } = validateSkillFiles([
        { path: 'SKILL.md', content: 'x' },
        { path: 'a.md', content: 'x' },
        { path: 'a.md', content: 'y' },
        { path: '../evil.md', content: 'x' },
        { path: 'big.md', content: 'x'.repeat(SKILL_LIMITS.MAX_FILE_BYTES + 1) },
      ]);
      expect(errors).toHaveLength(4);
      expect(errors.join(' ')).toContain('SKILL.md is generated');
      expect(errors.join(' ')).toContain('Duplicate');
      expect(errors.join(' ')).toContain('Invalid skill file path');
      expect(errors.join(' ')).toContain('too large');
    });

    test('warns on non-conventional folders and long SKILL.md', () => {
      const { warnings, errors } = validateSkillFiles(
        [{ path: 'docs/guide.md', content: 'x' }],
        { instructions: Array(SKILL_LIMITS.MAX_SKILL_MD_LINES + 2).fill('line').join('\n') }
      );
      expect(errors).toEqual([]);
      expect(warnings.join(' ')).toContain('references/');
      expect(warnings.join(' ')).toContain('lines');
    });

    test('enforces the total bundle budget including instructions', () => {
      const { errors } = validateSkillFiles(
        Array.from({ length: 6 }, (_, i) => ({
          path: `f${i}.md`,
          content: 'x'.repeat(190_000),
        })),
        { instructions: '' }
      );
      expect(errors.join(' ')).toContain('too large; max 1000000');
    });
  });
});

describe('parseSkillLibraryKey', () => {
  test('splits skill folder from relative path', () => {
    expect(parseSkillLibraryKey('/pdf-tools/SKILL.md')).toEqual({
      skillName: 'pdf-tools',
      relativePath: 'SKILL.md',
      isSkillMd: true,
    });
    expect(parseSkillLibraryKey('pdf-tools/references/api.md')).toEqual({
      skillName: 'pdf-tools',
      relativePath: 'references/api.md',
      isSkillMd: false,
    });
    // Case-insensitive SKILL.md detection normalizes the canonical name
    expect(parseSkillLibraryKey('/pdf-tools/skill.md').isSkillMd).toBe(true);
    expect(parseSkillLibraryKey('/pdf-tools/skill.md').relativePath).toBe('SKILL.md');
  });

  test('rejects folder-only keys, bad names, and traversal', () => {
    expect(() => parseSkillLibraryKey('/pdf-tools')).toThrow(/inside a skill folder/);
    expect(() => parseSkillLibraryKey('/Bad_Name/SKILL.md')).toThrow(/lowercase/);
    expect(() => parseSkillLibraryKey('/x/SKILL.md')).toThrow(/lowercase/); // too short
    expect(() => parseSkillLibraryKey('/../SKILL.md')).toThrow();
    expect(() => parseSkillLibraryKey('')).toThrow();
  });
});

describe('parseSkillMdContent', () => {
  test('parses plain and JSON-encoded frontmatter values', () => {
    const { metadata, body } = parseSkillMdContent(
      '---\nname: "pdf-tools"\ndescription: Extract text from PDFs.\n---\n\n## Workflow\ndo things'
    );
    expect(metadata).toEqual({ name: 'pdf-tools', description: 'Extract text from PDFs.' });
    expect(body).toBe('## Workflow\ndo things');
  });

  test('returns null metadata when frontmatter is missing', () => {
    const { metadata, body } = parseSkillMdContent('just instructions');
    expect(metadata).toBeNull();
    expect(body).toBe('just instructions');
  });

  test('round-trips renderSkillMarkdown output', async () => {
    const { renderSkillMarkdown } = await import('../src/utils/skillMarkdown.js');
    const md = renderSkillMarkdown({
      name: 'my-skill',
      description: 'Does: things "quoted"',
      instructions: '# Body',
    });
    const { metadata, body } = parseSkillMdContent(md);
    expect(metadata.name).toBe('my-skill');
    expect(metadata.description).toBe('Does: things "quoted"');
    expect(body).toBe('# Body');
  });
});

describe('buildSkillFiles with files[]', () => {
  test('files[] takes precedence over legacy codeSnippets', () => {
    const files = buildSkillFiles({
      name: 'pdf-tools',
      description: 'PDF workflows',
      instructions: 'Use the script.',
      files: [{ path: 'references/api.md', content: '# API', mimeType: 'text/markdown' }],
      codeSnippets: [{ filename: 'old.py', code: 'legacy' }],
    });
    expect(Object.keys(files).sort()).toEqual([
      '/pdf-tools/SKILL.md',
      '/pdf-tools/references/api.md',
    ]);
    expect(files['/pdf-tools/references/api.md'].content).toBe('# API');
    expect(files['/pdf-tools/references/api.md'].mimeType).toBe('text/markdown');
  });
});

describe('SkillLibraryStore', () => {
  const store = new SkillLibraryStore();
  const ns = skillLibraryNamespace('user-1');
  let mockSkill;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSkill = {
      name: 'pdf-tools',
      description: 'PDF workflows for agents',
      instructions: 'Use the script carefully.',
      files: [{ path: 'references/api.md', content: '# API', mimeType: 'text/markdown' }],
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      save: jest.fn().mockResolvedValue(undefined),
    };
    Skill.find.mockResolvedValue([mockSkill]);
    Skill.findOne.mockResolvedValue(mockSkill);
    Skill.create.mockResolvedValue({});
  });

  test('namespace helper stringifies ids', () => {
    expect(skillLibraryNamespace('u1')).toEqual(['users', 'u1', 'skill-library']);
  });

  test('get returns SKILL.md and supporting files', async () => {
    const md = await store.get(ns, '/pdf-tools/SKILL.md');
    expect(md.value.content).toContain('Use the script carefully.');
    const ref = await store.get(ns, '/pdf-tools/references/api.md');
    expect(ref.value.content).toBe('# API');
    expect(await store.get(ns, '/pdf-tools/missing.md')).toBeNull();
  });

  test('get returns null outside a user namespace', async () => {
    expect(await store.get(['agents', 'a1'], '/pdf-tools/SKILL.md')).toBeNull();
  });

  test('search lists all files sorted with offset/limit', async () => {
    // localeCompare ordering: 'references' sorts before 'SKILL.md'
    const all = await store.search(ns);
    expect(all.map((i) => i.key)).toEqual([
      '/pdf-tools/references/api.md',
      '/pdf-tools/SKILL.md',
    ]);
    const page = await store.search(ns, { limit: 1, offset: 1 });
    expect(page.map((i) => i.key)).toEqual(['/pdf-tools/SKILL.md']);
  });

  test('writing SKILL.md with frontmatter creates a new private skill', async () => {
    Skill.findOne.mockResolvedValue(null);
    Skill.find.mockResolvedValue([]);
    await store.put(ns, '/data-viz/SKILL.md', {
      content:
        '---\nname: data-viz\ndescription: Charts and plots for tabular data.\n---\n\n## Workflow\nmake charts',
    });
    expect(Skill.create).toHaveBeenCalledWith({
      ownerId: 'user-1',
      name: 'data-viz',
      description: 'Charts and plots for tabular data.',
      instructions: '## Workflow\nmake charts',
      isPublic: false,
    });
  });

  test('writing SKILL.md updates an existing skill in place', async () => {
    await store.put(ns, '/pdf-tools/SKILL.md', {
      content:
        '---\nname: pdf-tools\ndescription: Updated description here.\n---\n\nNew instructions body.',
    });
    expect(mockSkill.description).toBe('Updated description here.');
    expect(mockSkill.instructions).toBe('New instructions body.');
    expect(mockSkill.save).toHaveBeenCalled();
    expect(Skill.create).not.toHaveBeenCalled();
  });

  test('SKILL.md frontmatter name must match the folder', async () => {
    await expect(
      store.put(ns, '/pdf-tools/SKILL.md', {
        content: '---\nname: other-name\ndescription: A valid description.\n---\n\nBody text here.',
      })
    ).rejects.toThrow(/must match the folder name/);
  });

  test('new skills require a description in frontmatter', async () => {
    Skill.findOne.mockResolvedValue(null);
    Skill.find.mockResolvedValue([]);
    await expect(
      store.put(ns, '/data-viz/SKILL.md', { content: 'instructions with no frontmatter' })
    ).rejects.toThrow(/frontmatter including a description/);
  });

  test('supporting files require the skill to exist first', async () => {
    Skill.findOne.mockResolvedValue(null);
    Skill.find.mockResolvedValue([]);
    await expect(
      store.put(ns, '/data-viz/references/x.md', { content: 'hello' })
    ).rejects.toThrow(/create \/data-viz\/SKILL\.md first/);
  });

  test('supporting file writes add and update files[]', async () => {
    await store.put(ns, '/pdf-tools/scripts/run.py', { content: 'print(1)' });
    expect(mockSkill.files.map((f) => f.path)).toContain('scripts/run.py');
    expect(mockSkill.save).toHaveBeenCalled();

    await store.put(ns, '/pdf-tools/references/api.md', { content: '# API v2' });
    expect(mockSkill.files.find((f) => f.path === 'references/api.md').content).toBe('# API v2');
  });

  test('supporting file writes enforce per-file size limit', async () => {
    await expect(
      store.put(ns, '/pdf-tools/references/big.md', {
        content: 'x'.repeat(SKILL_LIMITS.MAX_FILE_BYTES + 1),
      })
    ).rejects.toThrow(/too large/);
  });

  test('parallel supporting-file writes are serialized (no overlapping saves)', async () => {
    let active = 0;
    let maxActive = 0;
    mockSkill.save.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });

    await Promise.all([
      store.put(ns, '/pdf-tools/references/a.md', { content: 'aaa' }),
      store.put(ns, '/pdf-tools/references/b.md', { content: 'bbb' }),
      store.put(ns, '/pdf-tools/references/c.md', { content: 'ccc' }),
    ]);

    expect(maxActive).toBe(1);
    const paths = mockSkill.files.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining(['references/a.md', 'references/b.md', 'references/c.md'])
    );
  });

  test('a write is retried once after a mongoose VersionError', async () => {
    mockSkill.save
      .mockRejectedValueOnce(Object.assign(new Error('stale doc'), { name: 'VersionError' }))
      .mockResolvedValue(undefined);

    await store.put(ns, '/pdf-tools/references/retry.md', { content: 'retry me' });
    expect(mockSkill.save).toHaveBeenCalledTimes(2);
    expect(mockSkill.files.some((f) => f.path === 'references/retry.md')).toBe(true);
  });

  test('a failed write does not wedge the per-user queue', async () => {
    mockSkill.save
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined);

    await expect(
      store.put(ns, '/pdf-tools/references/fail.md', { content: 'x' })
    ).rejects.toThrow('boom');
    // The queue must keep serving subsequent writes.
    await store.put(ns, '/pdf-tools/references/after.md', { content: 'y' });
    expect(mockSkill.files.some((f) => f.path === 'references/after.md')).toBe(true);
  });

  test('deleting SKILL.md is blocked; supporting files are removed', async () => {
    await expect(store.put(ns, '/pdf-tools/SKILL.md', null)).rejects.toThrow(/manage_skill/);

    await store.put(ns, '/pdf-tools/references/api.md', null);
    expect(mockSkill.files.find((f) => f.path === 'references/api.md')).toBeUndefined();
    expect(mockSkill.save).toHaveBeenCalled();
  });
});
