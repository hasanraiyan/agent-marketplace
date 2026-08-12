# Providers Module

## Purpose

Manages **LLM provider configurations** — stores API keys and connection details for OpenAI-compatible AI providers. Provider API keys are encrypted at rest using AES-256-GCM encryption.

## Location

`src/modules/providers/`

## Structure

```
src/modules/providers/
├── index.js                   # Barrel exports
├── provider.routes.js         # REST API routes
├── provider.controller.js     # HTTP handlers
├── provider.service.js        # Business logic
├── provider.repository.js     # Database access
├── provider.model.js          # Mongoose schema
└── provider.validator.js      # Zod validation schemas
```

## Responsibilities

- CRUD operations for provider configurations
- API key encryption at rest
- Provider connection testing
- Model listing for providers
- Credential validation (detect placeholder keys)

## Data Model (Provider)

| Field             | Type            | Description               |
| ----------------- | --------------- | ------------------------- |
| `ownerId`         | ObjectId (User) | Provider owner            |
| `label`           | String (1-100)  | Display name              |
| `baseURL`         | String          | API base URL              |
| `apiKeyEncrypted` | String          | AES-256 encrypted API key |
| `defaultModel`    | String          | Default model name        |
| `isDefault`       | Boolean         | Default provider flag     |

## Public API

| Method   | Path                                | Auth     | Purpose                  |
| -------- | ----------------------------------- | -------- | ------------------------ |
| `GET`    | `/api/v1/providers`                 | Required | List user's providers    |
| `POST`   | `/api/v1/providers`                 | Required | Create provider          |
| `POST`   | `/api/v1/providers/test-connection` | Required | Test credentials (no ID) |
| `POST`   | `/api/v1/providers/:id/test`        | Required | Test connection by ID    |
| `GET`    | `/api/v1/providers/:id/models`      | Required | List available models    |
| `PUT`    | `/api/v1/providers/:id`             | Required | Update provider          |
| `DELETE` | `/api/v1/providers/:id`             | Required | Delete provider          |

## Dependencies

| Dependency          | Type     | Purpose                       |
| ------------------- | -------- | ----------------------------- |
| Auth module         | Internal | Authentication                |
| Rate Limiter module | Internal | Rate limiting                 |
| Encryption          | Utility  | API key encryption/decryption |

## Important Business Rules

### API Key Encryption

- Keys are encrypted with AES-256-GCM before storage
- Encrypted format: `enc:v1:<keyId>:<iv>:<tag>:<ciphertext>`
- Supports key rotation (multiple keys can be configured, one active)
- Missing or decryption-failed keys produce clear error messages

### Placeholder Detection

The system detects common placeholder API key patterns (`sk-your-`, `your-api-key`, `placeholder`) and rejects them, preventing accidental deployment with fake credentials.

### Default Provider

Users can mark one provider as default. The default is used automatically when creating new agents or when the Architect agent needs a provider.

## Extension Guide

### Adding a New Provider Type

The system is designed to work with any OpenAI-compatible API. To support a new provider:

1. Add its base URL and any special headers
2. The existing `ChatOpenAI` client supports any base URL
3. No code changes needed for OpenAI-compatible providers

### Adding Provider-Specific Features

If needed, extend `provider.model.js` with new fields and add validation in `provider.validator.js`.
