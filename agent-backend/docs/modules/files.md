# Files Module

The **Files** module handles user- and project-level file storage, metadata tracking, and stream delivery for assets referenced across agent conversations and developer workflows.

## Overview

Files are uploaded via multipart forms (handled by Multer) or direct API streaming. The Files module stores metadata (original name, MIME type, file size, storage path/URI, ownership context) and provides access control and streaming endpoints.

## Directory Structure

```
src/modules/files/
├── file.model.js        # Mongoose schema for File metadata (name, mimeType, size, path, domain, ownerId)
├── file.repository.js   # Database queries for files
└── file.service.js      # Business logic: upload registration, validation, deletion
```

## Key Capabilities

1. **Ownership & Domain Isolation**: Files are scoped by `domain` (for Developer projects) or `ownerId` (for individual Persona users).
2. **Metadata Tracking**: Persists original filenames, MIME detection, size in bytes, and storage URI.
3. **MIME Type Validation**: Supports documents (PDF, TXT, MD, CSV, JSON), images (PNG, JPEG, WEBP), and audio clips for multimodal processing.
4. **Integration with Agents & Workflows**: Files stored here can be attached to conversation threads or referenced by Workflow nodes as input artifacts.

## Related Modules

- [`upload`](upload.md): Express middleware and Multer storage engine handling physical multipart file writes.
- [`developerFileRouter`](../developer-api-integration-guide.md): Developer platform endpoints (`/api/v1/developer/files`) enabling machine SDK upload and retrieval.
