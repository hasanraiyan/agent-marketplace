import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dist = (file: string) => fileURLToPath(new URL(`../dist/${file}`, import.meta.url));
const built = existsSync(dist('client.js')) && existsSync(dist('server.js'));

// These assert on build output, so they only mean anything after `pnpm build`.
describe.skipIf(!built)('build output', () => {
  it('keeps the "use client" boundary on the client entry', () => {
    for (const file of ['client.js', 'client.cjs']) {
      // The directive must be in the prologue, not merely present somewhere.
      const prologue = readFileSync(dist(file), 'utf8').slice(0, 200);
      expect(prologue, file).toMatch(/^(?:['"]use \w+['"];\s*)*['"]use client['"];/m);
    }
  });

  it('never marks the server entry as client code', () => {
    for (const file of ['server.js', 'server.cjs']) {
      expect(readFileSync(dist(file), 'utf8'), file).not.toContain('use client');
    }
  });

  it('imports nothing Node-specific, so the server entry runs on the Edge runtime', () => {
    for (const file of ['server.js', 'server.cjs']) {
      expect(readFileSync(dist(file), 'utf8'), file).not.toMatch(/["']node:/);
    }
  });
});
