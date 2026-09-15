#!/usr/bin/env node
/**
 * snapshot-docs.mjs — Greenfield publisher: sdk/{pkg}/docs → platform/content/docs/{sdk}/v{version}/
 *
 * Usage:
 *   node platform/scripts/snapshot-docs.mjs --sdk sdk --to 0.9.0
 *   node platform/scripts/snapshot-docs.mjs --all
 *
 * Copies hand-written guides + runs typedoc-to-mdx for generated Resources/Types into the immutable
 * snapshot at `platform/content/docs/{id}/v{version}/`.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const docsV2Root = join(repoRoot, 'platform', 'content', 'docs');

const SDK_MAP = {
  sdk:      { srcDocs: 'sdk/typescript/docs',  packageJson: 'sdk/typescript/package.json',  typedoc: 'sdk/typescript/typedoc.json' },
  runtime:  { srcDocs: 'sdk/runtime/docs',     packageJson: 'sdk/runtime/package.json',     typedoc: 'sdk/runtime/typedoc.json' },
  adapters: { srcDocs: 'sdk/adapters/docs',    packageJson: 'sdk/adapters/package.json',    typedoc: 'sdk/adapters/typedoc.json' },
  react:    { srcDocs: 'sdk/react/docs',       packageJson: 'sdk/react/package.json',       typedoc: 'sdk/react/typedoc.json' },
};

function pkgVersion(sdk) {
  const p = JSON.parse(readFileSync(join(repoRoot, SDK_MAP[sdk].packageJson), 'utf8'));
  return p.version;
}

function snapshotOne(sdk, toVersion) {
  const cfg = SDK_MAP[sdk];
  if (!cfg) throw new Error(`Unknown sdk "${sdk}" — expected one of ${Object.keys(SDK_MAP).join(', ')}`);
  const version = toVersion ?? pkgVersion(sdk);
  const src = join(repoRoot, cfg.srcDocs);
  const dest = join(docsV2Root, sdk, `v${version}`);

  if (!existsSync(src)) {
    console.warn(`[snapshot] ${sdk}: src docs missing at ${src} — creating empty guides placeholder`);
    mkdirSync(join(src, 'guides'), { recursive: true });
  }
  mkdirSync(dest, { recursive: true });
  // Copy hand-written docs (guides/, hooks/, index.mdx, quickstart.mdx, etc.) if any
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    cpSync(s, d, { recursive: true, force: true });
    console.log(`[snapshot] ${sdk}: copied ${entry.name} → ${sdk}/v${version}/`);
  }
  // Stub: typedoc-to-mdx will populate resources/*.generated.mdx and types.mdx
  // For now, leave a marker so CI knows generation is expected
  const marker = join(dest, '.needs-typedoc');
  writeFileSync(marker, `Run: npx typedoc --options ${cfg.typedoc} && node platform/scripts/typedoc-to-mdx.mjs --sdk ${sdk} --to ${version}\n`);
  console.log(`[snapshot] ${sdk}: snapshot at ${dest} — run typedoc-to-mdx to fill generated API pages`);
}

const args = process.argv.slice(2);
if (args.includes('--all')) {
  for (const sdk of Object.keys(SDK_MAP)) snapshotOne(sdk);
} else {
  const i = args.indexOf('--sdk');
  if (i === -1) {
    console.error('Usage: node platform/scripts/snapshot-docs.mjs --sdk <sdk|all> [--to <version>]  or  --all');
    process.exit(1);
  }
  const sdk = args[i + 1];
  const j = args.indexOf('--to');
  const to = j !== -1 ? args[j + 1] : undefined;
  snapshotOne(sdk, to);
}
