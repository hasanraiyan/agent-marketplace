# Pagination

## Overview

Paginated endpoints return a standardized pagination envelope alongside the data.

## Paginated Response Format

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "data": {
    "items": [
      { "id": "...", "name": "...", ... },
      { "id": "...", "name": "...", ... }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 10,
      "pages": 15
    }
  },
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```

## Pagination Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | Number | 1 | Page number (1-indexed) |
| `limit` | Number | 10 | Items per page (max: 100) |

## Default Constants

```javascript
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};
```

## Usage in Controllers

Controllers extract pagination from `req.query`:

```javascript
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 10;
const skip = (page - 1) * limit;
```

## Paginated Endpoints

The following endpoints support pagination:

| Endpoint | Parameters | Notes |
|----------|-----------|-------|
| `GET /api/v1/agents/search` | `page`, `limit` | POST body |
| `GET /api/v1/threads` | `page`, `limit` | Query params |
| `GET /api/v1/skills` | `page`, `limit` | Query params |
| `GET /api/v1/mcps` | `page`, `limit` | Query params |
| `GET /api/v1/knowledge` | `page`, `limit` | Query params |
| `GET /api/v1/admin/users` | `page`, `limit` | Query params |

## Response Helper

The `formatList` utility in `src/utils/formatters/successFormatter.js` builds the paginated response:

```javascript
import { formatters } from '../../utils/index.js';

res.json(formatters.formatList(items, total, page, limit));
```
