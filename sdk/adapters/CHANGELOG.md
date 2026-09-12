# Changelog

All notable changes to @personaai/adapters will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
