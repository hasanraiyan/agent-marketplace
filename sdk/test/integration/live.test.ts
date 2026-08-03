/**
 * Opt-in integration suite — runs the real SDK against a real, already-running
 * agent-backend + real MongoDB. Skipped by default; the unit tests (mocked
 * fetch) are what run in normal CI.
 *
 * The SDK package must never import from `agent-backend` directly (it's a
 * public npm package, not part of that private repo) — so this suite can't
 * mint its own credential the way this initiative's throwaway smoke scripts
 * did. Instead, point it at a credential you've already minted (via Studio
 * or the control-plane API) for a disposable test Project:
 *
 *   PERSONA_SDK_INTEGRATION_TEST=1 \
 *   PERSONA_TEST_BASE_URL=http://localhost:3000 \
 *   PERSONA_TEST_CREDENTIAL=<keyId>.<secret> \
 *   PERSONA_TEST_PROVIDER_ID=<a real Provider _id in that Project> \
 *   pnpm test test/integration/live.test.ts
 *
 * PERSONA_TEST_PROVIDER_ID is only required for the Agent/Knowledge tests
 * (both need an existing Provider); everything else only needs the
 * credential. Every resource this suite creates is deleted again at the
 * end of its own test — run repeatedly against the same Project without
 * accumulating data.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { PersonaClient, EventType } from '../../src/index.js';

const RUN = process.env.PERSONA_SDK_INTEGRATION_TEST === '1';
const baseUrl = process.env.PERSONA_TEST_BASE_URL ?? 'https://api.persona.hasanraiyan.me';
const credential = process.env.PERSONA_TEST_CREDENTIAL;
const providerId = process.env.PERSONA_TEST_PROVIDER_ID;

if (!RUN || !credential) {
  // A plain `if` gate around the whole `describe` call (rather than
  // `describe.skipIf`) — Vitest still *executes* a skipped describe's
  // factory function to enumerate its tests, which would construct
  // `PersonaClient` with an undefined credential and throw before any
  // skip logic even applies. Gating registration entirely avoids that.
  describe.skip('SDK integration (live backend) — skipped: set PERSONA_SDK_INTEGRATION_TEST=1 and PERSONA_TEST_CREDENTIAL to run', () => {
    it('skipped', () => {});
  });
} else {
  describe('SDK integration (live backend)', () => {
    const client = new PersonaClient({ baseUrl, credential });
    const runtimeClient = new PersonaClient({
      baseUrl,
      credential,
      externalUserId: `sdk-integration-${Date.now()}`,
    });

    it('whoami() resolves a real principal context', async () => {
      const who = await client.whoami();
      expect(who.principalType).toBe('ProjectMachine');
      expect(who.domain).toBeTruthy();
    });

    it('Providers: full create/get/update/delete lifecycle', async () => {
      const provider = await client.providers.create({
        label: `sdk-integration-provider-${Date.now()}`,
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-integration-test-not-real',
        defaultModel: 'gpt-4o-mini',
      });
      expect(provider.id).toBeTruthy();

      const fetched = await client.providers.get(provider.id);
      expect(fetched.id).toBe(provider.id);

      const updated = await client.providers.update(provider.id, { label: 'updated-label' });
      expect(updated.label).toBe('updated-label');

      await client.providers.delete(provider.id);
      await expect(client.providers.get(provider.id)).rejects.toThrow();
    });

    it('Skills: full create/list/get/update/delete lifecycle', async () => {
      const skill = await client.skills.create({
        name: `sdk-int-skill-${Date.now()}`.slice(0, 64).toLowerCase(),
        description: 'A skill created by the SDK integration suite.',
        instructions: 'This skill is only used for automated testing.',
      });
      expect(skill._id).toBeTruthy();

      const fetched = await client.skills.get(skill._id);
      expect(fetched._id).toBe(skill._id);

      const list = await client.skills.list();
      expect(list.items.some((s) => s._id === skill._id)).toBe(true);

      const updated = await client.skills.update(skill._id, { isPublic: true });
      expect(updated.isPublic).toBe(true);

      await client.skills.delete(skill._id);
      await expect(client.skills.get(skill._id)).rejects.toThrow();
    });

    it.skipIf(!providerId)(
      'Agents + Chat: create an Agent, chat with it, delete it',
      async () => {
        const agent = await client.agents.create({
          name: `sdk-integration-agent-${Date.now()}`,
          systemPrompt: 'You are a terse test agent used only for automated integration tests.',
          providerId: providerId!,
          visibility: 'unlisted',
        });
        expect(agent._id).toBeTruthy();

        try {
          const fetched = await client.agents.get(agent._id);
          expect(fetched._id).toBe(agent._id);

          const list = await client.agents.list();
          expect(list.items.some((a) => a._id === agent._id)).toBe(true);

          const result = await runtimeClient.chat.sendMessage(agent._id, {
            messages: [{ role: 'user', content: 'Reply with only the word: OK' }],
          });
          expect(result.text.length).toBeGreaterThan(0);
          expect(result.events.some((e) => e.type === EventType.RUN_FINISHED)).toBe(true);
        } finally {
          await client.agents.delete(agent._id);
        }
      },
      30_000
    );

    it.skipIf(!providerId)(
      'Knowledge: create a KB, upload + search a document, delete it',
      async () => {
        const kb = await client.knowledge.create({
          name: `sdk-integration-kb-${Date.now()}`,
          providerId: providerId!,
        });
        expect(kb._id).toBeTruthy();

        try {
          const upload = await client.knowledge.uploadDocuments(kb._id, [
            {
              filename: 'integration-test.txt',
              content: new TextEncoder().encode('The magic word is ZEBRA-INTEGRATION.'),
              contentType: 'text/plain',
            },
          ]);
          expect(upload.documentCount).toBe(1);

          const results = await client.knowledge.search(kb._id, 'magic word');
          expect(results.length).toBeGreaterThan(0);
        } finally {
          await client.knowledge.delete(kb._id);
        }
      },
      30_000
    );

    it('MCP: full create/get/update/delete lifecycle', async () => {
      const mcp = await client.mcps.create({
        name: `sdk-integration-mcp-${Date.now()}`,
        transport: 'http',
        url: 'https://mcp.example.com/no-such-server',
      });
      expect(mcp._id).toBeTruthy();

      const updated = await client.mcps.update(mcp._id, { isEnabled: false });
      expect(updated.isEnabled).toBe(false);

      await client.mcps.delete(mcp._id);
    });

    it.skipIf(!providerId)(
      'Threads + Files: create a Thread, upload a File to it, clean up',
      async () => {
        const agent = await client.agents.create({
          name: `sdk-integration-thread-agent-${Date.now()}`,
          systemPrompt: 'You are a terse test agent used only for automated integration tests.',
          providerId: providerId!,
          visibility: 'unlisted',
        });

        try {
          const thread = await runtimeClient.threads.create({ agentId: agent._id });
          expect(thread._id).toBeTruthy();

          const file = await runtimeClient.files.upload({
            filename: 'integration-test.txt',
            content: new TextEncoder().encode('integration test file content'),
            contentType: 'text/plain',
            threadId: thread._id,
          });

          const downloaded = await runtimeClient.files.download(file.id);
          expect(await downloaded.text()).toBe('integration test file content');

          await runtimeClient.files.delete(file.id);
          await runtimeClient.threads.delete(thread._id);
        } finally {
          await client.agents.delete(agent._id);
        }
      }
    );

    afterAll(() => {
      console.log(
        'Integration suite complete — every resource created was deleted by its own test.'
      );
    });
  });
}
