# Installation

## Prerequisites

| Requirement           | Version | Notes                            |
| --------------------- | ------- | -------------------------------- |
| **Node.js**           | 22+     | Required for ES Modules support  |
| **pnpm**              | 10+     | Package manager                  |
| **MongoDB**           | 7+      | Database (local or Atlas)        |
| **Qdrant** (optional) | Any     | Vector store for knowledge bases |

## Clone and Install

```bash
# Navigate to the backend directory
cd agent-backend

# Install dependencies
pnpm install
```

This installs all production and development dependencies including LangChain, LangGraph, Deep Agents, Mongoose, Clerk SDK, and all other required packages.

## Verify Installation

```bash
# Check Node.js version
node --version
# Should be >= 22

# Check pnpm version
pnpm --version
# Should be >= 10
```

## Scripts Overview

Available scripts (from `package.json`):

| Script                      | Command                                                                                             | Purpose                      |
| --------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------- |
| `start`                     | `node src/index.js`                                                                                 | Production start             |
| `dev`                       | `nodemon src/index.js`                                                                              | Development with auto-reload |
| `test`                      | `cross-env NODE_ENV=test node --experimental-vm-modules ./node_modules/jest/bin/jest.js --coverage` | Run tests with coverage      |
| `test:watch`                | `jest --watch`                                                                                      | Watch mode for tests         |
| `format`                    | `prettier --write \"**/*.{js,json,md}\"`                                                            | Format all files             |
| `format:check`              | `prettier --check \"**/*.{js,json,md}\"`                                                            | Check formatting             |
| `ai:verify`                 | `node ./scripts/verify-ai-stack.js`                                                                 | Verify AI stack setup        |
| `admin:create`              | `node ./scripts/create-admin.js`                                                                    | Create admin user            |
| `keygen:secrets:encryption` | `node ./scripts/generate-encryption-key.js`                                                         | Generate encryption keys     |
| `keygen:secrets:jwt`        | `node ./scripts/generate-auth-secrets.js`                                                           | Generate JWT secrets         |
| `migrate:memories`          | `node ./scripts/migrate-memories-to-files.js`                                                       | Migrate memory data          |
| `migrate:skill-files`       | `node ./scripts/migrate-skill-snippets-to-files.js`                                                 | Migrate skill files          |
