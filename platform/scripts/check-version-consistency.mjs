#!/usr/bin/env node
/**
 * check-version-consistency.mjs — Greenfield: 4-SDK registry ↔ package.json coherence.
 *
 * Fails if `platform/content/docs/registry.json:latest` drifts from
 * `sdk/{pkg}/package.json:version` by more than a patch (minor must match).
 * Patch drift is allowed (docs share the minor folder), minor/major drift is not.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const MAP = {
  sdk:      { pkg: 'sdk/typescript/package.json', registryId: 'sdk' },
  runtime:  { pkg: 'sdk/runtime/package.json',    registryId: 'runtime' },
  adapters: { pkg: 'sdk/adapters/package.json',   registryId: 'adapters' },
  react:    { pkg: 'sdk/react/package.json',      registryId: 'react' },
};

const registryPath = join(repoRoot, 'platform/content/docs/registry.json');
if (!existsSync(registryPath)) { console.warn(`[version-consistency] skip — ${registryPath} missing`); process.exit(0); }
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));

let failed = false;
for (const [sdk, cfg] of Object.entries(MAP)) {
  const pkg = JSON.parse(readFileSync(join(repoRoot, cfg.pkg), 'utf8'));
  const pkgVer = pkg.version; // e.g. 0.9.0
  const entry = registry.sdks.find(s => s.id === cfg.registryId);
  if (!entry) { console.error(`[version-consistency] ${sdk}: missing registry entry id=${cfg.registryId}`); failed = true; continue; }
  const regVer = entry.latest;
  const pkgMinor = pkgVer.split('.').slice(0,2).join('.');
  const regMinor = String(regVer).split('.').slice(0,2).join('.');
  if (pkgMinor !== regMinor) {
    console.error(`[version-consistency] ${sdk}: MINOR MISMATCH — package.json ${pkgVer} vs registry latest ${regVer} (minor ${pkgMinor} ≠ ${regMinor})`);
    console.error(`  → update registry.json or bump package — docs latest must track package minor`);
    failed = true;
  } else if (pkgVer !== regVer) {
    console.log(`[version-consistency] ${sdk}: patch drift OK — package ${pkgVer} vs registry ${regVer} (same minor ${pkgMinor})`);
  } else {
    console.log(`[version-consistency] ${sdk}: OK — ${pkgVer}`);
  }
  if (!entry.versions.includes(regVer)) {
    console.error(`[version-consistency] ${sdk}: latest ${regVer} not in versions[] ${JSON.stringify(entry.versions)}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
