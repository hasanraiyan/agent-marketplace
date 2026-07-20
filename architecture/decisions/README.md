# Architectural Decision Records (ADRs)

This directory contains records of important architectural decisions made during the Persona.ai Express backend refactoring. Each record outlines the context, alternatives considered, reasoning, and consequences of the choice.

## Catalog

* **[001-modular-directory-structure.md](file:///D:/projects/agent-marketplace/architecture/decisions/001-modular-directory-structure.md)**
  Transitioning from a technical-layer file organization to a domain/feature-based directory structure.
* **[002-repository-pattern-standardization.md](file:///D:/projects/agent-marketplace/architecture/decisions/002-repository-pattern-standardization.md)**
  Enforcing strict repository boundaries to completely abstract database queries from controllers and external domain services.
* **[003-unified-validation-boundary.md](file:///D:/projects/agent-marketplace/architecture/decisions/003-unified-validation-boundary.md)**
  Removing duplicate validation calls by trusting route validation middleware and using request mutability for parsed parameters.
* **[004-decoupling-agui-sse-orchestration.md](file:///D:/projects/agent-marketplace/architecture/decisions/004-decoupling-agui-sse-orchestration.md)**
  Decoupling SSE headers and stream responses from the core LangGraph building and token generation loop.
