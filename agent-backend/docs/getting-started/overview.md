# Overview

## What is Persona.ai Backend?

Persona.ai Backend is a REST API that powers an **intelligent agent orchestration platform**. It allows users to:

- **Create and configure AI agents** — Define system prompts, assign LLM providers, attach skills, connect MCP servers, and configure knowledge bases
- **Chat with agents** — Stream AI responses via Server-Sent Events (SSE) using the AG-UI protocol
- **Manage LLM providers** — Store and encrypt API keys for OpenAI-compatible providers
- **Attach capabilities** — Give agents web search, MCP tools, skills, and RAG knowledge bases
- **Persist conversations** — Thread-based chat with LangGraph checkpointing for stateful interactions
- **Manage skills** — Create reusable skill packages with instructions and reference files
- **Connect MCP servers** — OAuth-based MCP protocol integration with tool discovery

## Tech Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js 22+ (ES Modules) |
| **Framework** | Express 5 |
| **Database** | MongoDB via Mongoose 9 |
| **Validation** | Zod 4 |
| **Authentication** | Clerk (external auth provider) |
| **AI Framework** | LangChain, LangGraph, Deep Agents |
| **Vector Store** | Qdrant (for knowledge base RAG) |
| **Email** | Resend + Mailgen |
| **MCP** | `@modelcontextprotocol/sdk`, `@langchain/mcp-adapters` |
| **Encryption** | AES-256-GCM (field-level) |
| **Testing** | Jest + Supertest |
| **Formatting** | Prettier |
| **Package Manager** | pnpm |

## Architecture Principles

The backend follows these design principles:

1. **Domain-Based Modularity** — Each business capability is a self-contained module under `src/modules/<name>/`
2. **Layered Architecture** — Every module follows `route → controller → service → repository → model`
3. **SOLID Principles** — Single responsibility, dependency inversion, interface segregation
4. **Repository Pattern** — Data access is abstracted behind repositories
5. **Encryption at Rest** — All API keys and tokens are encrypted with AES-256-GCM

## When to Use This Backend

- Building AI-powered applications with customizable agents
- Creating multi-tenant agent platforms
- Building RAG systems with document ingestion
- Integrating with MCP-compatible tools and services
- Building chat interfaces with streaming AI responses
