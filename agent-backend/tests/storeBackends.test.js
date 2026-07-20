import {
  slugifySkillName,
  sanitizeSkillFilename,
  renderSkillMarkdown,
  buildSkillFiles,
} from '../src/utils/skillMarkdown.js';
import { AgentSkillsStore } from '../src/utils/agentSkillsStore.js';
import { readonlyBackend } from '../src/utils/readonlyBackend.js';
import { gracefulBackend } from '../src/utils/gracefulBackend.js';
import {
  normalizeMemoryKey,
  userMemoryNamespace,
  agentMemoryNamespace,
} from '../src/modules/agents/memory-files-store.js';

describe('skillMarkdown', () => {
  test('slugifies odd skill names into safe directory segments', () => {
    expect(slugifySkillName('My Cool Skill!')).toBe('my-cool-skill');
    expect(slugifySkillName('  ../../etc ')).toBe('etc');
    expect(slugifySkillName('###')).toBe('skill');
  });

  test('sanitizes supporting filenames and rejects traversal', () => {
    expect(sanitizeSkillFilename('helper.py')).toBe('helper.py');
    expect(sanitizeSkillFilename('references/api.md')).toBe('references/api.md');
    expect(sanitizeSkillFilename('../escape.md')).toBeNull();
    expect(sanitizeSkillFilename('~/home.md')).toBeNull();
    expect(sanitizeSkillFilename('')).toBeNull();
  });

  test('renders SKILL.md with JSON-encoded frontmatter', () => {
    const md = renderSkillMarkdown({
      name: 'my-skill',
      description: 'Does: things "quoted"',
      instructions: '# Body',
    });
    expect(md).toContain('name: "my-skill"');
    expect(md).toContain('description: "Does: things \\"quoted\\""');
    expect(md.endsWith('# Body')).toBe(true);
  });

  test('builds SKILL.md plus supporting files', () => {
    const files = buildSkillFiles({
      name: 'pdf-tools',
      description: 'PDF workflows',
      instructions: 'Use the script.',
      files: [
        { path: 'extract.py', content: 'print(1)' },
        { path: '../evil.py', content: 'x' },
      ],
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    });
    expect(Object.keys(files).sort()).toEqual(['/pdf-tools/SKILL.md', '/pdf-tools/extract.py']);
    expect(files['/pdf-tools/SKILL.md'].content).toContain('Use the script.');
    expect(files['/pdf-tools/extract.py'].content).toBe('print(1)');
    expect(files['/pdf-tools/SKILL.md'].modified_at).toBe('2026-01-02T00:00:00.000Z');
  });
});

describe('AgentSkillsStore (static skills, no DB)', () => {
  const store = new AgentSkillsStore({
    staticSkillFiles: {
      'agent-1': {
        '/alpha/SKILL.md': 'alpha content',
        '/beta/SKILL.md': 'beta content',
      },
    },
  });

  test('get returns a store item for an existing file', async () => {
    const item = await store.get(['agents', 'agent-1', 'enabled'], '/alpha/SKILL.md');
    expect(item).not.toBeNull();
    expect(item.value.content).toBe('alpha content');
    expect(item.value.created_at).toBeDefined();
  });

  test('get returns null for missing files and foreign namespaces', async () => {
    expect(await store.get(['agents', 'agent-1', 'enabled'], '/missing.md')).toBeNull();
    expect(await store.get(['agents', 'agent-2', 'enabled'], '/alpha/SKILL.md')).toBeNull();
    expect(await store.get(['users', 'agent-1'], '/alpha/SKILL.md')).toBeNull();
  });

  test('search returns sorted items and honors limit/offset', async () => {
    const all = await store.search(['agents', 'agent-1', 'enabled']);
    expect(all.map((i) => i.key)).toEqual(['/alpha/SKILL.md', '/beta/SKILL.md']);

    const page = await store.search(['agents', 'agent-1', 'enabled'], { limit: 1, offset: 1 });
    expect(page.map((i) => i.key)).toEqual(['/beta/SKILL.md']);
  });

  test('put is ignored (read-only facade)', async () => {
    await store.put(['agents', 'agent-1', 'enabled'], '/alpha/SKILL.md', {
      content: 'overwritten',
    });
    const item = await store.get(['agents', 'agent-1', 'enabled'], '/alpha/SKILL.md');
    expect(item.value.content).toBe('alpha content');
  });
});

describe('readonlyBackend', () => {
  const inner = {
    ls: async () => ({ files: [] }),
    read: async () => ({ content: 'data' }),
    readRaw: async () => ({ data: {} }),
    grep: async () => ({ matches: [] }),
    glob: async () => ({ files: [] }),
    downloadFiles: async () => [],
    write: async () => ({ path: '/x', filesUpdate: null }),
    edit: async () => ({ path: '/x', filesUpdate: null, occurrences: 1 }),
    uploadFiles: async () => [],
  };
  const guarded = readonlyBackend(inner, '/skills/');

  test('reads pass through', async () => {
    expect(await guarded.read('/skills/a/SKILL.md')).toEqual({ content: 'data' });
  });

  test('writes and edits return errors instead of mutating', async () => {
    const writeRes = await guarded.write('/skills/a/SKILL.md', 'x');
    expect(writeRes.error).toContain('read-only');
    const editRes = await guarded.edit('/skills/a/SKILL.md', 'a', 'b');
    expect(editRes.error).toContain('read-only');
    expect(editRes.occurrences).toBe(0);
    const uploadRes = await guarded.uploadFiles([['/skills/a/x.md', new Uint8Array()]]);
    expect(uploadRes[0].error).toBe('permission_denied');
  });
});

describe('gracefulBackend', () => {
  const inner = {
    ls: async () => ({ files: [] }),
    read: async () => ({ content: 'data' }),
    readRaw: async () => ({ data: {} }),
    grep: async () => ({ matches: [] }),
    glob: async () => ({ files: [] }),
    downloadFiles: async () => [],
    write: async (path) => {
      if (path.includes('bad')) throw new Error("Skill 'x' does not exist yet");
      return { path, filesUpdate: null };
    },
    edit: async () => {
      throw new Error('validation failed');
    },
    uploadFiles: async () => {
      throw new Error('upload rejected');
    },
  };
  const guarded = gracefulBackend(inner);

  test('successful writes pass through untouched', async () => {
    expect(await guarded.write('/skill-library/a/SKILL.md', 'x')).toEqual({
      path: '/skill-library/a/SKILL.md',
      filesUpdate: null,
    });
  });

  test('thrown store errors become tool-visible { error } results', async () => {
    const writeRes = await guarded.write('/skill-library/bad/references/x.md', 'x');
    expect(writeRes.error).toContain('does not exist yet');
    expect(writeRes.filesUpdate).toBeNull();

    const editRes = await guarded.edit('/skill-library/a/SKILL.md', 'a', 'b');
    expect(editRes.error).toBe('validation failed');
    expect(editRes.occurrences).toBe(0);

    const uploadRes = await guarded.uploadFiles([['/skill-library/a/x.md', new Uint8Array()]]);
    expect(uploadRes[0].error).toBe('upload rejected');
  });

  test('reads pass through', async () => {
    expect(await guarded.read('/skill-library/a/SKILL.md')).toEqual({ content: 'data' });
  });
});

describe('memoryFilesStore helpers', () => {
  test('normalizeMemoryKey normalizes and validates paths', () => {
    expect(normalizeMemoryKey('index.md')).toBe('/index.md');
    expect(normalizeMemoryKey('/topics//prefs.md')).toBe('/topics/prefs.md');
    expect(normalizeMemoryKey('a\\b.md')).toBe('/a/b.md');
    expect(() => normalizeMemoryKey('../escape.md')).toThrow();
    expect(() => normalizeMemoryKey('')).toThrow();
  });

  test('namespace helpers stringify ids', () => {
    expect(userMemoryNamespace('u1')).toEqual(['users', 'u1']);
    expect(agentMemoryNamespace('u1', 'a1')).toEqual(['users', 'u1', 'agents', 'a1']);
  });
});
