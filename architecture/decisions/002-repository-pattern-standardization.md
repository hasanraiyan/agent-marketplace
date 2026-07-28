# ADR 002: Repository Pattern Standardization

## Decision

We will enforce the repository pattern across all database entities. Controllers and external domain services are prohibited from importing Mongoose models directly.

## Context

Currently, several controllers (e.g. `profile.controller.js`, `agent.controller.js`) and services (e.g. `skill.service.js`, `mcp.service.js`) bypass repositories to query database models directly. This leaks database details (Mongoose syntax, collections metadata) into the HTTP layer and other service domains, resulting in high coupling and fragile boundary violations.

## Alternatives Considered

1. **Allow Direct Model Access**: Let services and controllers query models directly.
   - _Rejected_: Promotes code duplication (e.g., repeating the same `.find()` parameters) and ties the business logic layer to the MongoDB ODM.
2. **Generic Base Repository**: Introduce an abstract generic base repository pattern.
   - _Rejected_: Introduces excessive boilerplate and NestJS-like over-engineering without solving a specific problem in a small JS project.

## Reasoning

By requiring repositories for all entities:

- Database operations are centralized.
- Business logic is decoupled from Mongoose syntax.
- Testing is simplified: we can mock repositories cleanly without spinning up full database connection mocks.
- Circular model mappings are prevented since features are separated at the repository interface.

## Consequences

- **Positive**:
  - Clean separation of concerns.
  - Isolated database schema updates.
  - Easy integration of caching at the repository layer.
- **Negative**:
  - Minor boilerplate additions (creating new repository files and methods for simple CRUDs).
