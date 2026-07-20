import { jest } from '@jest/globals';

// Mock repositories and services
jest.unstable_mockModule('../src/modules/knowledge/knowledge.repository.js', () => ({
  default: {
    findKbsByIds: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/knowledge/knowledge.service.js', () => ({
  default: {
    searchKnowledgeBase: jest.fn(),
    listDocumentSources: jest.fn(),
  },
}));

const knowledgeRepository = (await import('../src/modules/knowledge/knowledge.repository.js'))
  .default;
const knowledgeService = (await import('../src/modules/knowledge/knowledge.service.js')).default;
const { resolveKnowledgeBaseTools } = await import('../src/modules/knowledge/knowledge.tools.js');

describe('resolveKnowledgeBaseTools', () => {
  const mockUserId = 'user123';
  let mockKbs;

  beforeEach(() => {
    jest.clearAllMocks();

    mockKbs = [
      {
        _id: 'kb1',
        name: 'KB One',
        description: 'First test knowledge base',
        ownerId: mockUserId,
        isPublic: false,
      },
      {
        _id: 'kb2',
        name: 'KB Two',
        description: 'Second test knowledge base',
        ownerId: 'otherUser',
        isPublic: true,
      },
      {
        _id: 'kb3',
        name: 'KB Three',
        description: 'Private other knowledge base',
        ownerId: 'otherUser',
        isPublic: false,
      },
    ];
  });

  it('returns empty array when knowledgeBaseIds is empty or falsy', async () => {
    const tools = await resolveKnowledgeBaseTools([], mockUserId);
    expect(tools).toEqual([]);

    const toolsNull = await resolveKnowledgeBaseTools(null, mockUserId);
    expect(toolsNull).toEqual([]);
  });

  it('filters out private knowledge bases not owned by user', async () => {
    knowledgeRepository.findKbsByIds.mockResolvedValue(mockKbs);

    const tools = await resolveKnowledgeBaseTools(['kb1', 'kb2', 'kb3'], mockUserId);

    // Should only have search and list tools for allowed KBs: "KB One" and "KB Two" (since KB Two is public, KB One is owned)
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('search_knowledge_base');
    expect(tools[1].name).toBe('list_knowledge_base_sources');

    // Check that we retrieved all KBs from DB
    expect(knowledgeRepository.findKbsByIds).toHaveBeenCalledWith(['kb1', 'kb2', 'kb3']);
  });

  it('returns empty array if no knowledge bases are allowed', async () => {
    // Only kb3 is passed, which is private of otherUser
    knowledgeRepository.findKbsByIds.mockResolvedValue([mockKbs[2]]);

    const tools = await resolveKnowledgeBaseTools(['kb3'], mockUserId);
    expect(tools).toEqual([]);
  });

  it('correctly executes the search tool func', async () => {
    knowledgeRepository.findKbsByIds.mockResolvedValue([mockKbs[0], mockKbs[1]]);
    knowledgeService.searchKnowledgeBase.mockResolvedValue([
      { source: 'doc1.txt', text: 'matched information text' },
    ]);

    const tools = await resolveKnowledgeBaseTools(['kb1', 'kb2'], mockUserId);
    const searchTool = tools.find((t) => t.name === 'search_knowledge_base');

    const result = await searchTool.func({
      knowledgeBaseName: 'KB One',
      query: 'some search query',
    });

    expect(knowledgeService.searchKnowledgeBase).toHaveBeenCalledWith('kb1', 'some search query');
    expect(result).toBe('[Source: doc1.txt]: matched information text');
  });

  it('correctly handles search tool not found KB', async () => {
    knowledgeRepository.findKbsByIds.mockResolvedValue([mockKbs[0]]);
    const tools = await resolveKnowledgeBaseTools(['kb1'], mockUserId);
    const searchTool = tools.find((t) => t.name === 'search_knowledge_base');

    const result = await searchTool.func({
      knowledgeBaseName: 'KB Unknown',
      query: 'some search query',
    });

    expect(result).toContain('not found');
    expect(knowledgeService.searchKnowledgeBase).not.toHaveBeenCalled();
  });

  it('correctly executes the list sources tool func', async () => {
    knowledgeRepository.findKbsByIds.mockResolvedValue([mockKbs[0]]);
    knowledgeService.listDocumentSources.mockResolvedValue([
      {
        fileName: 'doc1.txt',
        fileSize: 1024,
        mimeType: 'text/plain',
        chunkCount: 3,
        uploadedAt: 'date',
      },
    ]);

    const tools = await resolveKnowledgeBaseTools(['kb1'], mockUserId);
    const listTool = tools.find((t) => t.name === 'list_knowledge_base_sources');

    const result = await listTool.func({
      knowledgeBaseName: 'KB One',
    });

    expect(knowledgeService.listDocumentSources).toHaveBeenCalledWith('kb1', mockUserId);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].fileName).toBe('doc1.txt');
  });
});
