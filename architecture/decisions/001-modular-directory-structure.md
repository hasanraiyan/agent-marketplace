# ADR 001: Modular Directory Structure

## Decision

We will reorganize the codebase from a technical-layered folder structure (all routes in `routes/`, all controllers in `controllers/`) to a domain-based modular structure inside `src/modules/`.

## Context

As a backend grows, a technical-layered layout creates high friction for developer operations. Modifying a single feature requires opening files scattered across multiple root directories (`routes`, `controllers`, `services`, `models`, `validators`). This technical organization masks high coupling between domains. Reorganizing files into features (such as `agents`, `skills`, `knowledge`) keeps highly related files colocated.

## Alternatives Considered

1. **Maintain Current Structure**: Keep files sorted by technical layer and only refactor logic within existing boundaries.
   - _Rejected_: Fails to resolve the underlying friction of feature maintenance and does not provide clean architectural boundaries.
2. **NestJS Migration**: Complete transition to NestJS.
   - _Rejected_: Explicitly prohibited by absolute constraints. Adding NestJS introduces high compile-time overhead and alters developer workflows.

## Reasoning

Grouping files by domain makes it easier to:

- Enforce strict module boundaries.
- Reuse domain subcomponents.
- Discover related route, validator, controller, service, repository, and model files.
- Test features in isolation.

## Consequences

- **Positive**:
  - Clear code ownership.
  - Colocation of features reduces file navigation overhead.
  - Easier path to scale, delete, or rewrite individual modules.
- **Negative**:
  - Requires moving almost all files in the repository.
  - Involves updating all import paths (e.g. `../controllers/` will change).
