# REST API Tools Module

## Purpose

Enables no-code and low-code definition of HTTP REST API endpoints as AI Agent tools. Developers can configure HTTP paths, methods, query parameters, headers, and request bodies with templated parameters (`{{param}}`) and reserved security tokens (such as `{{externalUserId}}`).

## Location

`src/modules/restApiTools/` and `src/modules/restApiToolSources/`

## Structure

```
src/modules/restApiTools/
├── index.js                         # Barrel exports & route attachments
├── restApiTool.model.js             # Mongoose schema for REST tool definitions
├── restApiTool.repository.js         # Database operations
├── restApiTool.service.js           # Tool testing, execution & templating
├── restApiTool.controller.js        # HTTP request handlers
├── restApiTool.routes.js            # Express routes
└── restApiTool.validator.js         # Zod schemas for validation
```

## Responsibilities

- **Declarative Tool Builder**: Allows non-programmers to wrap existing REST APIs (GET, POST, PUT, PATCH, DELETE) as agent tools.
- **Templating & Parameter Substitution**: Supports Mustache variable substitution across URL paths, headers, query parameters, and JSON bodies.
- **Security & Reserved Tokens**: Automatically resolves protected tokens like `{{externalUserId}}` or `{{callerPhone}}` from caller context, preventing users from spoofing credentials.
- **LangChain Tool Binding**: Translates stored REST tool schemas into executable LangChain `DynamicStructuredTool` instances.
- **Test Sandbox**: Provides a live `POST /test` endpoint to simulate execution before attaching tools to production agents.

## Public API & Endpoints

Mounted under `/api/v1/developer/projects/{projectId}/rest-api-tools`:

| Method   | Path         | Auth         | Purpose                                |
| -------- | ------------ | ------------ | -------------------------------------- |
| `GET`    | `/`          | ProjectAdmin | List defined REST API tools in project |
| `POST`   | `/`          | ProjectAdmin | Create new REST API tool definition    |
| `GET`    | `/{id}`      | ProjectAdmin | Get REST tool details                  |
| `PUT`    | `/{id}`      | ProjectAdmin | Update REST tool configuration         |
| `DELETE` | `/{id}`      | ProjectAdmin | Delete REST tool                       |
| `POST`   | `/{id}/test` | ProjectAdmin | Test execution against upstream API    |

## Dependencies

| Dependency        | Type     | Purpose                                |
| ----------------- | -------- | -------------------------------------- |
| `agents` module   | Internal | Tool attachment to agent graphs        |
| `projects` module | Internal | Project secret resolution for API keys |
| `@langchain/core` | External | `DynamicStructuredTool` compilation    |
