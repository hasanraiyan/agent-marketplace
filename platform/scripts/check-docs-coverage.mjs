#!/usr/bin/env node
/**
 * check-docs-coverage.mjs — Greenfield: 4-SDK export ↔ docs index parity.
 *
 * Fails (exit 1) when any in-scope SDK's `src/index.ts` exports a symbol
 * not listed in its published docs `types.mdx` "Full export index" table.
 *
 * Scope: JS-only — sdk/runtime/adapters/react (logger/ui/python excluded per plan.md v2).
 *
 * Usage:
 *   node platform/scripts/check-docs-coverage.mjs
 *   node platform/scripts/check-docs-coverage.mjs --sdk sdk
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const registryPath = join(repoRoot, 'platform/content/docs/registry.json');
if (!existsSync(registryPath)) {
  console.warn(`[docs-coverage] skip — ${registryPath} missing`);
  process.exit(0);
}
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const latest = (id) => {
  const entry = registry.sdks.find((s) => s.id === id);
  if (!entry) throw new Error(`[docs-coverage] registry has no entry id=${id}`);
  return entry.latest;
};

const SDKS = {
  sdk:      { index: 'sdk/typescript/src/index.ts',            docs: `platform/content/docs/sdk/v${latest('sdk')}/types.mdx` },
  runtime:  { index: 'sdk/runtime/src/index.ts',                docs: `platform/content/docs/runtime/v${latest('runtime')}/types.mdx` },
  adapters: { index: 'sdk/adapters/src/express/index.ts',       docs: `platform/content/docs/adapters/v${latest('adapters')}/types.mdx` },
  react:    { index: 'sdk/react/src/index.ts',                  docs: `platform/content/docs/react/v${latest('react')}/types.mdx` },
};

function exportedNames(source) {
  const names = new Set();
  const braceRe = /export\s+(?:type\s+)?\{([^}]*)\}/g;
  let m;
  while ((m = braceRe.exec(source))) {
    for (const raw of m[1].split(',')) {
      const item = raw.trim();
      if (!item) continue;
      const name = item.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) names.add(name);
    }
  }
  const bareRe = /export\s+(?:type|const|class|function|interface)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  while ((m = bareRe.exec(source))) names.add(m[1]);
  // export * from "…" — not enumerable here; caller must ensure types.mdx covers re-exported barrels via coverage of the barrel itself
  return names;
}

function documentedNames(docsSource, docsPath) {
  const names = new Set();
  const start = docsSource.indexOf('## Full export index');
  if (start === -1) throw new Error(`Could not find "## Full export index" in ${docsPath}`);
  let inTable = false;
  const rows = [];
  for (const line of docsSource.slice(start).split('\n').slice(1)) {
    if (line.startsWith('## ')) break;
    if (line.trim().startsWith('|')) { rows.push(line); inTable = true; }
    else if (inTable && line.trim() !== '') break;
  }
  for (const row of rows) {
    for (const tick of row.matchAll(/`([^`]+)`/g)) {
      const name = tick[1].trim().replace(/<.*>$/, '').trim();
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) names.add(name);
    }
  }
  return names;
}

const filterSdk = process.argv.includes('--sdk') ? process.argv[process.argv.indexOf('--sdk')+1] : null;
const toCheck = filterSdk ? { [filterSdk]: SDKS[filterSdk] } : SDKS;

let failed = false;
for (const [sdk, cfg] of Object.entries(toCheck)) {
  if (!cfg) { console.error(`Unknown sdk "${filterSdk}"`); process.exit(1); }
  const indexPath = join(repoRoot, cfg.index);
  const docsPath = join(repoRoot, cfg.docs);
  if (!existsSync(indexPath)) { console.warn(`[docs-coverage] ${sdk}: skip — ${indexPath} missing`); continue; }
  if (!existsSync(docsPath)) { console.warn(`[docs-coverage] ${sdk}: skip — ${docsPath} missing (run snapshot + typedoc-to-mdx first)`); continue; }
  const idxSrc = readFileSync(indexPath, 'utf8');
  const docSrc = readFileSync(docsPath, 'utf8');
  if (docSrc.includes('(pending TypeDoc run)')) { console.warn(`[docs-coverage] ${sdk}: skip — stub types.mdx (pending TypeDoc)`); continue; }
  const exported = exportedNames(idxSrc);
  let documented;
  try { documented = documentedNames(docSrc, docsPath); } catch (e) { console.warn(`[docs-coverage] ${sdk}: ${e.message} — skipping`); continue; }
  const missing = [...exported].filter(n => !documented.has(n)).sort();
  if (missing.length) {
    console.error(`[docs-coverage] ${sdk}: ${missing.length} export(s) missing from ${cfg.docs}:`);
    for (const n of missing) console.error(`  - ${n}`);
    failed = true;
  } else {
    console.log(`[docs-coverage] ${sdk}: OK — all ${exported.size} exports documented`);
  }
}
process.exit(failed ? 1 : 0);
