#!/usr/bin/env node
// Usage: node scripts/docs-bump.mjs --sdk=react --version=0.8.2 [--from=0.8.1]
// Copies content/docs/<sdk>/<from> → <version>, updates registry.json, appends changelog tracking.
import fs from "fs";
import path from "path";
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")));
const sdk = args.sdk;
const version = args.version;
if (!sdk || !version) { console.error("Usage: --sdk=react --version=0.8.2 [--from=0.8.1]"); process.exit(1); }
const registryPath = path.join("content/docs/registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const entry = registry.sdks.find(s => s.id === sdk);
if (!entry) { console.error(`sdk ${sdk} not in registry`); process.exit(1); }
const from = args.from || entry.latest;
const src = path.join("content/docs", sdk, `v${from}`);
const dst = path.join("content/docs", sdk, `v${version}`);
if (!fs.existsSync(src)) { console.error(`src ${src} missing`); process.exit(1); }
if (fs.existsSync(dst)) { console.error(`dst ${dst} already exists`); process.exit(1); }
fs.cpSync(src, dst, { recursive: true });
entry.versions = [version, ...entry.versions.filter(v => v !== version)];
entry.latest = version;
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
console.log(`Bumped ${sdk} ${from} → ${version}, registry updated. Next: edit ${dst}/*.mdx frontmatter version, then commit.`);
// Tracking: append to content/docs/_tracking.json
const trackPath = "content/docs/_tracking.json";
let track = [];
if (fs.existsSync(trackPath)) track = JSON.parse(fs.readFileSync(trackPath, "utf8"));
track.push({ sdk, version, from, date: new Date().toISOString().slice(0,10), commit: "" });
fs.writeFileSync(trackPath, JSON.stringify(track, null, 2) + "\n");
console.log(`Tracking appended to ${trackPath}`);
