#!/usr/bin/env node
/**
 * Doc-coverage check for @personaai/sdk.
 *
 * Fails (exit 1) when `src/index.ts` exports a public symbol that is not listed
 * in the "Full export index" table of `developer-docs/guides/sdk/types.mdx` —
 * so the docs can't silently fall out of date when a new class/type/const is
 * added to the SDK.
 *
 * Run from anywhere:
 *   node sdk/typescript/scripts/check-docs-coverage.mjs
 *   cd sdk/typescript && pnpm docs:check
 *
 * Optional positional args (mainly for testing the failure path):
 *   node scripts/check-docs-coverage.mjs <path-to-index.ts> <path-to-docs.mdx>
 *
 * (Pure Node built-ins — no dependencies, so it's safe to run in CI without
 * installing anything.)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SDK_INDEX = resolve(here, '../src/index.ts');
const DOCS_PAGE = resolve(here, '../../../developer-docs/guides/sdk/types.mdx');

const indexPath = process.argv[2] ?? SDK_INDEX;
const docsPath = process.argv[3] ?? DOCS_PAGE;

const indexSource = readFileSync(indexPath, 'utf8');
const docsSource = readFileSync(docsPath, 'utf8');

/**
 * Every name exported from `src/index.ts`, both values and types.
 * Handles `export { A, type B }`, `export type { C }`, and `export { X as Y }`.
 */
function exportedNames(source) {
  const names = new Set();
  // Export statements with a brace list: export { ... } / export type { ... }
  const braceRe = /export\s+(?:type\s+)?\{([^}]*)\}/g;
  let m;
  while ((m = braceRe.exec(source))) {
    for (const raw of m[1].split(',')) {
      const item = raw.trim();
      if (!item) continue;
      // Strip the "type" marker and any "as" alias (keep the exported name).
      const name = item.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) names.add(name);
    }
  }
  // Bare `export type Name = ...` / `export const Name = ...` (none today, future-proof).
  const bareRe = /export\s+(?:type|const|class|function|interface)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  while ((m = bareRe.exec(source))) names.add(m[1]);
  return names;
}

/**
 * Every backtick-delimited name in the "Full export index" table of
 * `types.mdx`. The table is the first one after the "Full export index"
 * heading; we read until the next heading (`##`).
 */
function documentedNames(source) {
  const names = new Set();
  const start = source.indexOf('## Full export index');
  if (start === -1) {
    throw new Error(`Could not find "## Full export index" heading in ${docsPath}`);
  }
  // Collect table rows until the next heading or the first non-table line after
  // the table has begun — so a future restructure that moves this section to
  // the end of the file can't let later field tables leak into the documented set.
  const rows = [];
  let inTable = false;
  for (const line of source.slice(start).split('\n').slice(1)) {
    if (line.startsWith('## ')) break;
    if (line.trim().startsWith('|')) {
      rows.push(line);
      inTable = true;
    } else if (inTable && line.trim() !== '') {
      break;
    }
  }
  for (const row of rows) {
    for (const tick of row.matchAll(/`([^`]+)`/g)) {
      const cell = tick[1].trim();
      // Strip generic parameters (e.g. `PaginatedResult<T>` -> PaginatedResult).
      const name = cell.replace(/<.*>$/, '').trim();
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) names.add(name);
    }
  }
  return names;
}

const exported = exportedNames(indexSource);
const documented = documentedNames(docsSource);

const missing = [...exported].filter((name) => !documented.has(name)).sort();

if (missing.length > 0) {
  console.error(
    `[docs-coverage] ${missing.length} export(s) from ${indexPath} are missing from the` +
      ` "Full export index" table in ${docsPath}:`
  );
  for (const name of missing) console.error(`  - ${name}`);
  console.error(
    `\nAdd each missing symbol to the export index table (and ideally its own section) in` +
      ` ${docsPath} before merging.`
  );
  process.exit(1);
}

console.log(
  `[docs-coverage] OK — all ${exported.size} public exports from ${indexPath} are` +
    ` documented in ${docsPath}.`
);
