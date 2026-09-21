import { jest } from '@jest/globals';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { createManageResourceTool } from '../src/modules/tools/manageResourceFactory.js';

/**
 * Exercises the shared manage_<resource> CRUD+patch dispatch
 * (manageResourceFactory.js) directly against fake list/get/create/update/
 * remove functions — this is genuinely new logic (the patch array-splice in
 * particular), not a rename, so it gets its own coverage rather than being
 * re-tested once per real resource (manage_mcp/manage_rcp_source/
 * manage_rest_api_tool all share this exact skeleton).
 */
describe('createManageResourceTool', () => {
  function buildTool(overrides = {}) {
    const list = jest.fn().mockResolvedValue([{ id: '1', name: 'One' }]);
    const get = jest.fn().mockResolvedValue({ id: '1', name: 'One', tags: ['a', 'b'] });
    const create = jest.fn().mockResolvedValue({ id: '2', name: 'Two' });
    const update = jest.fn().mockResolvedValue({ id: '1', name: 'Updated' });
    const remove = jest.fn().mockResolvedValue(undefined);

    const tool = createManageResourceTool({
      name: 'manage_thing',
      description: 'test resource',
      actions: ['create', 'read', 'update', 'patch', 'delete'],
      patchableFields: { name: 'scalar', tags: 'array' },
      list,
      get,
      create,
      update,
      remove,
      ...overrides,
    });

    return { tool, list, get, create, update, remove };
  }

  test('read with no id lists items', async () => {
    const { tool, list } = buildTool();
    const result = JSON.parse(await tool.invoke({ action: 'read' }));
    expect(result.status).toBe('success');
    expect(result.data).toEqual([{ id: '1', name: 'One' }]);
    expect(list).toHaveBeenCalledWith({});
  });

  test('read with id fetches one', async () => {
    const { tool, get } = buildTool();
    const result = JSON.parse(await tool.invoke({ action: 'read', id: '1' }));
    expect(result.status).toBe('success');
    expect(get).toHaveBeenCalledWith('1');
  });

  test('create requires data', async () => {
    const { tool, create } = buildTool();
    const result = JSON.parse(await tool.invoke({ action: 'create' }));
    expect(result.status).toBe('error');
    expect(create).not.toHaveBeenCalled();
  });

  test('create calls the injected create fn', async () => {
    const { tool, create } = buildTool();
    const result = JSON.parse(await tool.invoke({ action: 'create', data: { name: 'Two' } }));
    expect(result.status).toBe('success');
    expect(create).toHaveBeenCalledWith({ name: 'Two' });
  });

  test('update requires id and data', async () => {
    const { tool } = buildTool();
    expect(JSON.parse(await tool.invoke({ action: 'update', data: {} })).status).toBe('error');
    expect(JSON.parse(await tool.invoke({ action: 'update', id: '1' })).status).toBe('error');
  });

  test('delete requires id', async () => {
    const { tool, remove } = buildTool();
    expect(JSON.parse(await tool.invoke({ action: 'delete' })).status).toBe('error');
    const result = JSON.parse(await tool.invoke({ action: 'delete', id: '1' }));
    expect(result.status).toBe('success');
    expect(remove).toHaveBeenCalledWith('1');
  });

  test('an action not in `actions` is rejected by the schema itself', async () => {
    const { tool } = buildTool({ actions: ['read'] });
    await expect(tool.invoke({ action: 'create', data: {} })).rejects.toThrow();
  });

  describe('patch', () => {
    test('rejects a field not in patchableFields', async () => {
      const { tool } = buildTool();
      const result = JSON.parse(
        await tool.invoke({ action: 'patch', id: '1', field: 'nope', op: 'set', value: 'x' })
      );
      expect(result.status).toBe('error');
    });

    test('rejects add/remove on a scalar field', async () => {
      const { tool } = buildTool();
      const result = JSON.parse(
        await tool.invoke({ action: 'patch', id: '1', field: 'name', op: 'add', value: 'x' })
      );
      expect(result.status).toBe('error');
    });

    test('set on a scalar field calls update with just that field', async () => {
      const { tool, update } = buildTool();
      await tool.invoke({ action: 'patch', id: '1', field: 'name', op: 'set', value: 'New Name' });
      expect(update).toHaveBeenCalledWith('1', { name: 'New Name' });
    });

    test('add on an array field splices in the current doc without duplicating', async () => {
      const { tool, get, update } = buildTool();
      await tool.invoke({ action: 'patch', id: '1', field: 'tags', op: 'add', value: 'c' });
      expect(get).toHaveBeenCalledWith('1');
      expect(update).toHaveBeenCalledWith('1', { tags: ['a', 'b', 'c'] });

      // Adding an id already present is a no-op on the array contents.
      get.mockResolvedValueOnce({ id: '1', tags: ['a', 'b'] });
      await tool.invoke({ action: 'patch', id: '1', field: 'tags', op: 'add', value: 'a' });
      expect(update).toHaveBeenLastCalledWith('1', { tags: ['a', 'b'] });
    });

    test('remove on an array field splices the id out', async () => {
      const { tool, update } = buildTool();
      await tool.invoke({ action: 'patch', id: '1', field: 'tags', op: 'remove', value: 'a' });
      expect(update).toHaveBeenCalledWith('1', { tags: ['b'] });
    });

    test('add/remove compare by id when the array holds populated objects', async () => {
      const { tool, get, update } = buildTool();
      get.mockResolvedValueOnce({ id: '1', tags: [{ _id: 'a' }, { _id: 'b' }] });
      await tool.invoke({ action: 'patch', id: '1', field: 'tags', op: 'remove', value: 'a' });
      expect(update).toHaveBeenCalledWith('1', { tags: ['b'] });
    });
  });

  describe('tool schema is Gemini-compatible', () => {
    // Regression: `data`/`filters` used to be z.record(), which Zod 4 emits
    // with `propertyNames` — Gemini function declarations 400 on it
    // ("Unknown name \"propertyNames\""). OpenAI silently tolerated it.
    const forbidden = ['propertyNames'];
    const walk = (node, path = '') => {
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) {
        expect(forbidden).not.toContain(k);
        walk(v, `${path}.${k}`);
      }
    };

    test('emits no `propertyNames` anywhere in the JSON schema', () => {
      const { tool } = buildTool();
      const schema = toJsonSchema(tool.schema);
      walk(schema);
      // `data`/`filters` are free-form: bare schema + description, no empty
      // `properties: {}` either (Gemini rejects OBJECT with no properties).
      expect(schema.properties.data).toEqual({ description: expect.any(String) });
      expect(schema.properties.filters).toEqual({ description: expect.any(String) });
    });

    test('data/filters still reject non-object values at runtime', async () => {
      const { tool, create, list } = buildTool();
      await expect(tool.invoke({ action: 'create', data: 'nope' })).rejects.toThrow();
      await expect(tool.invoke({ action: 'read', filters: ['x'] })).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
      expect(list).not.toHaveBeenCalled();

      const ok = JSON.parse(await tool.invoke({ action: 'create', data: { name: 'x' } }));
      expect(ok.status).toBe('success');
      expect(create).toHaveBeenCalledWith({ name: 'x' });
    });
  });
});
