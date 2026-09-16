# Changelog

All notable changes to @personaai/adapters will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-09-16

### Changed

- Bumped `@personaai/react` to `^0.16.0`, `@personaai/runtime` to `^0.14.0`, and `@personaai/sdk`
  to `^0.12.0` — these versions remove the 0.5.0 Thread workspace-file CRUD (it read/wrote the
  wrong data source and is superseded by `scope: "workspace"` on the existing memory API) and add
  the corrected, Agent-scoped equivalent. No adapter-level code changes.

## [0.5.0] - 2026-09-16

### Changed

- Bumped `@personaai/react` to `^0.15.0`, `@personaai/runtime` to `^0.13.0`, and `@personaai/sdk`
  to `^0.11.0` — brings in the new Thread workspace-file CRUD (`threads.listFiles/getFile/writeFile/deleteFile`
  in the SDK, the matching `/threads/:id/files` and `/threads/:id/file` runtime routes, and the
  `useWorkspaceFiles()` React hook). No adapter-level code changes — the mount/translate layer is
  unaffected since these are just more routes proxied the same way as everything else.

## [0.4.0] - 2026-09-15

### Changed
- Bumped `@personaai/react` to `^0.11.0` (new `useSkills`, `useRcpSources`, full-CRUD `useAgents`),
  `@personaai/runtime` to `^0.12.0` (new `capabilities.rcpSources`), and `@personaai/sdk` to
  `^0.10.0` (new `RcpSourcesResource`). All three re-export/build on this package's `client`/`server`
  entry points unmodified — no code changes here, purely picking up the new self-serve resource CRUD
  surface (Agent/Workflow/MCP/RCP Source/Knowledge Base/Skill) end-to-end.

## [0.3.0] - 2026-09-14

### Removed
- **`@personaai/express`, `@personaai/nestjs`, and `@personaai/nextjs` removed from this repo.**
  These standalone packages were meant to become deprecated shims re-exporting from this package
  (per 0.2.0's own notes) but that migration was never actually done — each still carried its own
  independent implementation, ~95% duplicated from this package's `src/`. Rather than build the
  shim layer, the duplicate folders are deleted outright: the duplication was the real problem, not
  just its unpublished state. Their last-published npm versions keep working standalone (real
  implementations, not stubs) and are marked deprecated on the registry; there will be no further
  releases under those names. See README's "Migration from the removed packages".

### Added
- **Full re-export parity for `@personaai/adapters/express` and `/nestjs`.** Both now also export
  `TranslationError`, `toRuntimeRequest`, `writeRuntimeResponse`, `collectMulterFiles`,
  `parseMultipart`, and `MultipartResult` — the lower-level primitives the removed standalone
  packages exposed, previously missing from this package's public surface even though the
  underlying implementation (`src/shared/*`) already had them.
- **Real test coverage for this package's own `src/`.** Previously this package had zero tests of
  its own — `pnpm test` was silently running the *standalone* packages' test suites (picked up
  incidentally by a shared root vitest config), never exercising this package's actual code. Ported
  all of them (61 tests across express/nestjs/nextjs) to `test/` against this package's own
  implementation.
- **`compat/express4/`** — the standalone `@personaai/express` package's Express-4 compatibility
  suite (11 tests), ported to install this package via a `file:` link. Run with
  `pnpm test:express4`.

## [0.2.1] - 2026-09-14

### Changed
- Upgraded dependencies:
  - @personaai/sdk to ^0.9.0 (ArchitectClient.threadId support)
  - @personaai/runtime to ^0.11.0 (POST /architect forwards threadId)
  - @personaai/react to ^0.10.0 (useArchitectChat hook)
- No source changes in this package — every adapter here (express/nestjs/nextjs) is a generic
  translation layer over `runtime.handle()`, so the Architect's new threadId resume support is
  already reachable through all three without any adapter-specific code.

## [0.2.0] - 2026-09-12

### Added
- Re-exported WorkflowNodeContext from @personaai/adapters/nextjs/server to support custom server-side workflow node handlers.
- Added root itest.config.ts covering Express, Next.js, and NestJS test suites while excluding isolated compatibility folders.

### Changed
- Upgraded dependencies:
  - @personaai/react to ^0.9.0 (Workflows hooks support)
  - @personaai/runtime to ^0.10.0 (Native Workflows engine execution)
  - @personaai/sdk to ^0.8.0 (Workflows client & endpoints)

## [0.1.0] - 2026-07-20

### Added
- Initial release of @personaai/adapters unified package.
- Express adapter (@personaai/adapters/express).
- NestJS adapter (@personaai/adapters/nestjs).
- Next.js adapter (@personaai/adapters/nextjs & @personaai/adapters/nextjs/server).
