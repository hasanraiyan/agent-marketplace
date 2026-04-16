import { store, checkpointer, createBackend } from '../src/memory.js';
import { InMemoryStore, MemorySaver } from "@langchain/langgraph";
import { CompositeBackend } from "deepagents";

describe('memory', () => {
  it('should export an InMemoryStore instance as store', () => {
    expect(store).toBeInstanceOf(InMemoryStore);
  });

  it('should export a MemorySaver instance as checkpointer', () => {
    expect(checkpointer).toBeInstanceOf(MemorySaver);
  });

  it('should create a CompositeBackend instance', () => {
    const backend = createBackend({ some: 'config' });
    expect(backend).toBeInstanceOf(CompositeBackend);
  });
});
