# docs-v2 — Greenfield content (JS-only)

This directory is the **new docs content root** built from scratch per `plan.md` v2.

- **Legacy stays at `platform/content/docs/`** until plan approval (see `plan.md` §15 Step 2). Do NOT edit legacy for new SDK work.
- **Greenfield is `platform/content/docs-v2/`** — 4 SDKs × single latest version (sdk 0.9.0, runtime 0.11.0, adapters 0.3.0, react 0.10.0). No `python`/`logger`/`ui`.
- Source authoring lives in `sdk/{typescript,runtime,adapters,react}/docs/` and is **snapshotted** into `docs-v2/{sdk}/v{version}/` via `platform/scripts/snapshot-docs.mjs` (includes TypeDoc-generated `resources/*.generated.mdx`).
- On approval, `docs-v2` replaces `docs` in one move: `git rm -r platform/content/docs && git mv platform/content/docs-v2 platform/content/docs`.

Registry: `registry.json` — 4 entries only. Versioning: per-minor (see `plan.md` §7). Generated API ref: TypeDoc (see `plan.md` §9).
