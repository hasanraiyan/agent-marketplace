#!/usr/bin/env node
/**
 * build-search.mjs — Build client search index over listDocs
 *
 * Reads `platform/content/docs/{sdk}/v{version}/**` via the same logic as
 * `src/lib/docs/mdx.ts` (listDocs + readDoc) plus `platform/content/concepts/**`,
 * and writes a static JSON index for client-side search.
 *
 * Output:
 *   platform/public/search-index.json — array of { id, sdk, version, slug, href, title, description, headings, snippet }
 *   platform/content/docs/search-index.json — copy for reference
 *
 * Client can consume with flexsearch/pagefind or naive filter. For greenfield MVP,
 * the index is pre-tokenized plain text — no heavy client indexer needed.
 *
 * Usage: node platform/scripts/build-search.mjs
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const docsBase = join(repoRoot, 'platform', 'content', 'docs');
const conceptsBase = join(repoRoot, 'platform', 'content', 'concepts');
const registryPath = join(docsBase, 'registry.json');

function listDocs(sdk, version) {
  const dir = join(docsBase, sdk, `v${version}`);
  if (!existsSync(dir)) return [];
  const out = [];
  function walk(cur, prefix) {
    for (const e of readdirSync(cur, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = join(cur, e.name);
      if (e.isDirectory()) walk(p, [...prefix, e.name]);
      else if (e.name.endsWith('.mdx') || e.name.endsWith('.md')) {
        const slug = [...prefix, e.name.replace(/\.mdx$/, '').replace(/\.md$/, '')];
        if (slug[slug.length - 1] === 'index') slug.pop();
        out.push(slug.join('/') || '');
      }
    }
  }
  walk(dir, []);
  return out;
}

function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/^#+\s+/gm, ' ')
    .replace(/^\s*\|.*\|.*$/gm, ' ')
    .replace(/^\s*[-*]\s+/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function headingsFrom(md) {
  const heads = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) heads.push(m[2].replace(/\[([^\]]+)\]\(.*?\)/g, '$1').trim());
  }
  return heads.slice(0, 8);
}

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const index = [];
let id = 0;

for (const sdk of registry.sdks) {
  for (const version of sdk.versions) {
    const slugs = listDocs(sdk.id, version);
    for (const slug of slugs) {
      const base = join(docsBase, sdk.id, `v${version}`);
      const tryPaths = [join(base, slug + '.mdx'), join(base, slug, 'index.mdx'), join(base, slug + '.md'), join(base, slug, 'index.md')];
      let raw, data, content;
      for (const p of tryPaths) if (existsSync(p)) { raw = readFileSync(p, 'utf8'); ({ data, content } = matter(raw)); break; }
      if (!raw) continue;
      const slugArr = slug ? slug.split('/') : [];
      const href = slug ? `/docs/${sdk.id}/v${version}/${slug}` : `/docs/${sdk.id}/v${version}`;
      const title = data.title || (slugArr[slugArr.length - 1] || sdk.title);
      const description = data.description || '';
      const plain = stripMarkdown(content);
      const snippet = plain.slice(0, 280);
      const headings = headingsFrom(content);
      index.push({
        id: id++,
        sdk: sdk.id,
        version,
        slug: slugArr,
        href,
        title,
        description,
        headings,
        snippet,
        tokens: (title + ' ' + description + ' ' + headings.join(' ') + ' ' + plain.slice(0, 2000)).toLowerCase(),
      });
    }
  }
}

// Concepts (version-agnostic) — also searchable
if (existsSync(conceptsBase)) {
  function walkConcepts(cur, prefix) {
    for (const e of readdirSync(cur, { withFileTypes: true })) {
      const p = join(cur, e.name);
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) walkConcepts(p, [...prefix, e.name]);
      else if (e.name.endsWith('.mdx') || e.name.endsWith('.md')) {
        const raw = readFileSync(p, 'utf8');
        const { data, content } = matter(raw);
        const slug = [...prefix, e.name.replace(/\.mdx$/, '').replace(/\.md$/, '')].join('/');
        const href = `/concepts/${slug}`;
        const title = data.title || slug;
        const description = data.description || '';
        const plain = stripMarkdown(content);
        index.push({
          id: id++,
          sdk: 'concepts',
          version: 'latest',
          slug: slug.split('/'),
          href,
          title,
          description,
          headings: headingsFrom(content),
          snippet: plain.slice(0, 280),
          tokens: (title + ' ' + description + ' ' + plain.slice(0, 2000)).toLowerCase(),
        });
      }
    }
  }
  walkConcepts(conceptsBase, []);
}

const outPublic = join(repoRoot, 'platform', 'public', 'search-index.json');
const outContent = join(docsBase, 'search-index.json');
mkdirSync(dirname(outPublic), { recursive: true });
writeFileSync(outPublic, JSON.stringify(index, null, 2));
writeFileSync(outContent, JSON.stringify(index, null, 2));
console.log(`[build-search] wrote ${index.length} documents`);
console.log(`  → ${outPublic}`);
console.log(`  → ${outContent}`);
for (const sdk of registry.sdks) console.log(`  - ${sdk.id}: ${index.filter(d => d.sdk === sdk.id).length} docs`);
console.log(`  - concepts: ${index.filter(d => d.sdk === 'concepts').length} docs`);
