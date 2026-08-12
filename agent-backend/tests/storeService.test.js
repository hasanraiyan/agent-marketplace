import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/stores/store.repository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    search: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: {
    findAgentsUsingStore: jest.fn(),
    removeStoreFromAgents: jest.fn(),
  },
}));
jest.unstable_mockModule('../src/modules/agents/agent.factory.js', () => ({
  default: { invalidate: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/memory/memory-file.model.js', () => ({
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

const storeRepository = (await import('../src/modules/stores/store.repository.js')).default;
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
const MemoryFile = (await import('../src/modules/memory/memory-file.model.js')).default;
const storeService = (await import('../src/modules/stores/store.service.js')).default;

function sortMock(value) {
  return { sort: jest.fn().mockResolvedValue(value) };
}

describe('storeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createStore stamps the caller domain onto the store data', async () => {
    storeRepository.create.mockResolvedValue({ _id: 's1', name: 'notes', domain: 'proj-1' });

    await storeService.createStore('proj-1', { name: 'notes', scope: 'domain' });

    expect(storeRepository.create).toHaveBeenCalledWith({
      name: 'notes',
      scope: 'domain',
      domain: 'proj-1',
    });
  });

  test('updateStore strips domain and scope from the patch (scope is immutable)', async () => {
    storeRepository.update.mockResolvedValue({ _id: 's1', name: 'renamed' });
    agentRepository.findAgentsUsingStore.mockResolvedValue([]);

    await storeService.updateStore('proj-1', 's1', {
      name: 'renamed',
      scope: 'externalUser',
      domain: 'someone-elses-domain',
    });

    expect(storeRepository.update).toHaveBeenCalledWith(
      's1',
      { domain: 'proj-1' },
      { name: 'renamed' }
    );
  });

  test('updateStore invalidates the factory cache for every agent using the store', async () => {
    storeRepository.update.mockResolvedValue({ _id: 's1' });
    agentRepository.findAgentsUsingStore.mockResolvedValue([{ _id: 'a1' }, { _id: 'a2' }]);

    await storeService.updateStore('proj-1', 's1', { description: 'x' });

    expect(agentFactory.invalidate).toHaveBeenCalledWith('a1');
    expect(agentFactory.invalidate).toHaveBeenCalledWith('a2');
  });

  test('deleteStore removes the store from every mounting agent, invalidates their cache, and purges domain-scoped data', async () => {
    storeRepository.findById.mockResolvedValue({
      _id: 's1',
      domain: 'proj-1',
      name: 'notes',
      scope: 'domain',
    });
    agentRepository.findAgentsUsingStore.mockResolvedValue([{ _id: 'a1' }]);
    MemoryFile.deleteMany.mockResolvedValue({ deletedCount: 3 });
    storeRepository.delete.mockResolvedValue({ _id: 's1' });

    await storeService.deleteStore('proj-1', 's1');

    expect(agentRepository.removeStoreFromAgents).toHaveBeenCalledWith('s1');
    expect(agentFactory.invalidate).toHaveBeenCalledWith('a1');
    expect(MemoryFile.deleteMany).toHaveBeenCalledWith({
      'namespace.0': 'stores',
      'namespace.1': 'proj-1',
      'namespace.2': 'notes',
    });
    expect(storeRepository.delete).toHaveBeenCalledWith('s1', { domain: 'proj-1' });
  });

  test("deleteStore purges every founder's partition for an externalUser-scoped store", async () => {
    storeRepository.findById.mockResolvedValue({
      _id: 's1',
      domain: 'proj-1',
      name: 'notes',
      scope: 'externalUser',
    });
    agentRepository.findAgentsUsingStore.mockResolvedValue([]);
    MemoryFile.deleteMany.mockResolvedValue({ deletedCount: 0 });
    storeRepository.delete.mockResolvedValue({ _id: 's1' });

    await storeService.deleteStore('proj-1', 's1');

    expect(MemoryFile.deleteMany).toHaveBeenCalledWith({
      'namespace.0': 'stores',
      'namespace.1': 'proj-1',
      'namespace.3': 'notes',
    });
  });

  test('deleteStore 404s for a store in a different domain', async () => {
    storeRepository.findById.mockResolvedValue({ _id: 's1', domain: 'someone-else' });

    await expect(storeService.deleteStore('proj-1', 's1')).rejects.toThrow('Store not found');
    expect(agentRepository.removeStoreFromAgents).not.toHaveBeenCalled();
  });

  describe('file CRUD', () => {
    test('getStoreFile uses the domain namespace for a domain-scoped store', async () => {
      storeRepository.findById.mockResolvedValue({
        _id: 's1',
        domain: 'proj-1',
        name: 'notes',
        scope: 'domain',
      });
      MemoryFile.findOne.mockResolvedValue({
        key: '/a.md',
        content: 'hi',
        mimeType: 'text/markdown',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await storeService.getStoreFile('proj-1', 's1', undefined, '/a.md');

      expect(MemoryFile.findOne).toHaveBeenCalledWith({
        namespace: ['stores', 'proj-1', 'notes'],
        key: '/a.md',
      });
    });

    test('getStoreFile requires an external user for an externalUser-scoped store', async () => {
      storeRepository.findById.mockResolvedValue({
        _id: 's1',
        domain: 'proj-1',
        name: 'notes',
        scope: 'externalUser',
      });

      await expect(storeService.getStoreFile('proj-1', 's1', undefined, '/a.md')).rejects.toThrow(
        'asserted external user'
      );
      expect(MemoryFile.findOne).not.toHaveBeenCalled();
    });

    test('two different external users on the same externalUser-scoped store never share a namespace', async () => {
      storeRepository.findById.mockResolvedValue({
        _id: 's1',
        domain: 'proj-1',
        name: 'notes',
        scope: 'externalUser',
      });
      MemoryFile.findOneAndUpdate.mockImplementation((query) => ({
        key: query.key,
        content: 'x',
        mimeType: 'text/markdown',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await storeService.writeStoreFile('proj-1', 's1', 'founder-a', {
        path: '/x.md',
        content: 'x',
      });
      await storeService.writeStoreFile('proj-1', 's1', 'founder-b', {
        path: '/x.md',
        content: 'x',
      });

      const [callA, callB] = MemoryFile.findOneAndUpdate.mock.calls;
      expect(callA[0].namespace).toEqual(['stores', 'proj-1', 'founder-a', 'notes']);
      expect(callB[0].namespace).toEqual(['stores', 'proj-1', 'founder-b', 'notes']);
    });
  });
});
