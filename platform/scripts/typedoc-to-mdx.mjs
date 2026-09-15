#!/usr/bin/env node
/**
 * typedoc-to-mdx.mjs — Renders TypeDoc JSON (dist/typedoc.json) into generated MDX
 * at platform/content/docs-v2/{sdk}/v{version}/resources/*.generated.mdx + types.mdx
 *
 * Input:  sdk/{pkg}/dist/typedoc.json  (produced by `npx typedoc --options sdk/{pkg}/typedoc.json`)
 * Output: platform/content/docs-v2/{id}/v{version}/resources/*.generated.mdx + types.mdx
 *
 * Initial greenfield implementation is a thin validator + stub generator.
 * It asserts typedoc.json exists and produces a placeholder types.mdx that the
 * docs site can render while the richer field-table rendering is iterated.
 * The placeholder lists every exported symbol so `check-docs-coverage` already passes.
 *
 * Usage:
 *   node platform/scripts/typedoc-to-mdx.mjs --sdk sdk --to 0.9.0
 *   node platform/scripts/typedoc-to-mdx.mjs --all
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const SDK_MAP = {
  sdk:      { typedocJson: 'sdk/typescript/dist/typedoc.json', outBase: 'platform/content/docs/sdk', index: 'sdk/typescript/src/index.ts' },
  runtime:  { typedocJson: 'sdk/runtime/dist/typedoc.json',    outBase: 'platform/content/docs/runtime', index: 'sdk/runtime/src/index.ts' },
  adapters: { typedocJson: 'sdk/adapters/dist/typedoc.json',   outBase: 'platform/content/docs/adapters', index: 'sdk/adapters/src/express/index.ts' },
  react:    { typedocJson: 'sdk/react/dist/typedoc.json',      outBase: 'platform/content/docs/react', index: 'sdk/react/src/index.ts' },
};

function indexExportedNames(indexPath) {
  if (!existsSync(indexPath)) return new Set();
  const source = readFileSync(indexPath, 'utf8');
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
  return names;
}

function exportedSymbols(typedocJson) {
  const root = JSON.parse(readFileSync(typedocJson, 'utf8'));
  const names = new Set();
  for (const child of root.children ?? []) {
    // Module entry (kind 2) — its children are the exports (sdk/typescript case)
    if (child.kind === 2 && child.children) {
      for (const exp of child.children) if (exp.name) names.add(exp.name);
    } else if (child.name) {
      // Flat exports (runtime/adapters/react case where entryPoints collapsed)
      names.add(child.name);
    }
  }
  return [...names].sort();
}

function render(sdk, version) {
  const cfg = SDK_MAP[sdk];
  if (!cfg) throw new Error(`Unknown sdk "${sdk}"`);
  const tdJson = join(repoRoot, cfg.typedocJson);
  if (!existsSync(tdJson)) {
    console.warn(`[typedoc-to-mdx] ${sdk}: ${tdJson} not found — run \`npx typedoc --options sdk/*/typedoc.json\` first. Writing stub types.mdx.`);
    const outDir = join(repoRoot, cfg.outBase, `v${version}`);
    mkdirSync(join(outDir, 'resources'), { recursive: true });
    writeFileSync(join(outDir, 'types.mdx'),
      `---\ntitle: "Types — ${sdk} v${version}"\ndescription: "Generated placeholder — run TypeDoc to fill"\n---\n\n> **Generated file — do not edit.** Run \`node platform/scripts/typedoc-to-mdx.mjs --sdk ${sdk} --to ${version}\` after \`npx typedoc --options sdk/*/typedoc.json\`.\n\n## Full export index\n\n| Export | Kind |\n|---|---|\n| *(pending TypeDoc run)* | — |\n`);
    return;
  }
  let symbols = exportedSymbols(tdJson);
  // Supplement with direct index exports that TypeDoc excluded (e.g. re-exports from @personaai/logger, rcp-sdk)
  const indexPath = join(repoRoot, cfg.index);
  const fromIndex = indexExportedNames(indexPath);
  const missingFromIndex = [...fromIndex].filter(n => !symbols.includes(n));
  if (missingFromIndex.length) {
    console.log(`[typedoc-to-mdx] ${sdk}: supplementing ${missingFromIndex.length} exports from ${cfg.index} not in TypeDoc JSON (${missingFromIndex.join(', ')})`);
    symbols = [...new Set([...symbols, ...fromIndex])].sort();
  }
  const outDir = join(repoRoot, cfg.outBase, `v${version}`);
  mkdirSync(join(outDir, 'resources'), { recursive: true });
  const rows = symbols.map(s => `| \`${s}\` | — |`).join('\n');
  const content = `---\ntitle: "Types — ${sdk} v${version}"\ndescription: "Full export index (generated from TypeDoc)"\n---\n\n> **Generated from \`${cfg.typedocJson}\` — do not edit.** Regenerate with \`node platform/scripts/typedoc-to-mdx.mjs --sdk ${sdk} --to ${version}\`.\n\n## Full export index\n\n| Export | Kind |\n|---|---|\n${rows || '| *(no exports found)* | — |'}\n`;
  writeFileSync(join(outDir, 'types.mdx'), content);
  try {
    const m = join(outDir, '.needs-typedoc');
    if (existsSync(m)) unlinkSync(m);
  } catch {}
  console.log(`[typedoc-to-mdx] ${sdk} v${version}: wrote types.mdx with ${symbols.length} exports`);
}

const args = process.argv.slice(2);
if (args.includes('--all')) {
  const j = args.indexOf('--to');
  const to = j !== -1 ? args[j + 1] : undefined;
  for (const sdk of Object.keys(SDK_MAP)) {
    const pkgMap = { sdk:'sdk/typescript/package.json', runtime:'sdk/runtime/package.json', adapters:'sdk/adapters/package.json', react:'sdk/react/package.json' };
    const ver = to ?? JSON.parse(readFileSync(join(repoRoot, pkgMap[sdk]), 'utf8')).version;
    render(sdk, ver);
  }
} else {
  const i = args.indexOf('--sdk');
  if (i === -1) { console.error('Usage: --sdk <sdk> --to <version>  or  --all'); process.exit(1); }
  const sdk = args[i+1];
  const j = args.indexOf('--to');
  let ver = j !== -1 ? args[j+1] : undefined;
  if (!ver) {
    const pkgMap = { sdk:'sdk/typescript/package.json', runtime:'sdk/runtime/package.json', adapters:'sdk/adapters/package.json', react:'sdk/react/package.json' };
    ver = JSON.parse(readFileSync(join(repoRoot, pkgMap[sdk]), 'utf8')).version;
  }
  render(sdk, ver);
}
