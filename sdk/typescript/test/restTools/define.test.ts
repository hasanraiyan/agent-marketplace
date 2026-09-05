import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineRestTool, EXTERNAL_USER_ID_TOKEN } from '../../src/restTools/define.js';

describe('defineRestTool', () => {
  it('derives paramDescriptors from a zod args schema', () => {
    const tool = defineRestTool({
      name: 'Get profile',
      method: 'GET',
      args: z.object({
        userId: z.string().describe('Coursify user id'),
        limit: z.number().optional(),
      }),
      url: (t) => `https://api.coursify.dev/users/${t.arg('userId')}`,
    });

    expect(tool.url).toBe('https://api.coursify.dev/users/{{userId}}');
    expect(tool.paramDescriptors).toEqual([
      { name: 'userId', in: 'body', type: 'string', description: 'Coursify user id', required: true },
      { name: 'limit', in: 'body', type: 'number', description: '', required: false },
    ]);
  });

  it('t.externalUserId expands to the reserved token', () => {
    const tool = defineRestTool({
      name: 'Get profile',
      method: 'GET',
      url: 'https://api.coursify.dev/me',
      headers: { 'X-Persona-User': (t) => t.externalUserId },
    });

    expect(tool.headers).toEqual([
      { key: 'X-Persona-User', valueTemplate: EXTERNAL_USER_ID_TOKEN, required: true },
    ]);
  });

  it('t.arg() throws for a name not declared in args', () => {
    expect(() =>
      defineRestTool({
        name: 'Get profile',
        method: 'GET',
        args: z.object({ userId: z.string() }),
        url: (t) => `https://api.coursify.dev/users/${t.arg('usreId' as never)}`,
      })
    ).toThrow(/unknown arg "usreId"/i);
  });

  it('rejects "externalUserId" declared as an arg', () => {
    expect(() =>
      defineRestTool({
        name: 'x',
        method: 'GET',
        args: z.object({ externalUserId: z.string() }) as never,
        url: 'https://example.com',
      })
    ).toThrow(/reserved template token/i);
  });

  it('JSON-stringifies an object body and sets bodyMode: json', () => {
    const tool = defineRestTool({
      name: 'Create note',
      method: 'POST',
      args: z.object({ text: z.string() }),
      url: 'https://api.coursify.dev/notes',
      body: (t) => ({ text: t.arg('text') }),
      responseMappings: { id: '@data.id' },
    });

    expect(tool.bodyMode).toBe('json');
    expect(tool.bodyTemplate).toBe(JSON.stringify({ text: '{{text}}' }));
    expect(tool.responseMappings).toEqual([{ field: 'id', path: '@data.id' }]);
  });

  it('defaults bodyMode to none and isEnabled to true when omitted', () => {
    const tool = defineRestTool({
      name: 'Ping',
      method: 'GET',
      url: 'https://api.coursify.dev/ping',
    });

    expect(tool.bodyMode).toBe('none');
    expect(tool.isEnabled).toBe(true);
    expect(tool.authType).toBe('none');
  });
});
