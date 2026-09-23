import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/skills/skill.model.js', () => ({
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

const Skill = (await import('../src/modules/skills/skill.model.js')).default;
const { ProjectSkillLibraryStore, projectSkillLibraryStore, projectSkillLibraryNamespace } =
  await import('../src/modules/skills/projectSkillLibraryStore.js');

describe('ProjectSkillLibraryStore', () => {
  const store = new ProjectSkillLibraryStore();
  const ns = projectSkillLibraryNamespace('project-domain-1');
  let mockSkill;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSkill = {
      name: 'pdf-tools',
      description: 'PDF workflows for project',
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

  test('namespace helper stringifies domain', () => {
    expect(projectSkillLibraryNamespace('p1')).toEqual(['projects', 'p1', 'skill-library']);
  });

  test('batch executes multiple ops and returns results', async () => {
    const ops = [
      { key: '/pdf-tools/SKILL.md', namespace: ns },
      { key: '/pdf-tools/references/api.md', namespace: ns },
      { namespacePrefix: ns },
      { other: 'unknown' },
    ];

    const results = await store.batch(ops);
    expect(results).toHaveLength(4);
    expect(results[0].value.content).toContain('Use the script carefully.');
    expect(results[1].value.content).toBe('# API');
    expect(Array.isArray(results[2])).toBe(true);
    expect(results[3]).toEqual([]);
  });

  test('benchmark batch operation timing', async () => {
    // Mock store methods to introduce simulated I/O delay
    jest.spyOn(store, '_get').mockImplementation(async (op) => {
      await new Promise((r) => setTimeout(r, 10));
      return { key: op.key };
    });
    jest.spyOn(store, '_search').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return [];
    });

    const numOps = 20;
    const ops = Array.from({ length: numOps }, (_, i) => ({
      key: `/pdf-tools/file${i}.md`,
      namespace: ns,
    }));

    const start = performance.now();
    const results = await store.batch(ops);
    const duration = performance.now() - start;

    expect(results).toHaveLength(numOps);
    console.log(`[Baseline Benchmark] batch with ${numOps} ops took ${duration.toFixed(2)}ms`);
  });
});
