# Logging

## Overview

The backend uses a **swappable logger** implementation (Dependency Inversion pattern). The default implementation logs to the console with timestamps and severity levels.

## Logger Implementation

### ConsoleLogger

Default logger at `src/utils/logger/ConsoleLogger.js`:

| Method | Level | Description |
|--------|-------|-------------|
| `info(message, data)` | INFO | General operational messages |
| `warn(message, data)` | WARN | Warning conditions |
| `error(message, error)` | ERROR | Error conditions with stack traces |
| `debug(message, data)` | DEBUG | Debug details (only shown in development/test) |

## Log Format

```
[LEVEL] ISO_TIMESTAMP - Message {optional data}
```

Examples:

```
[INFO] 2026-07-20T12:00:00.000Z - Server listening on port 3000
[INFO] 2026-07-20T12:00:00.000Z - MongoDB connected successfully
[ERROR] 2026-07-20T12:00:00.000Z - Request error occurred {
  message: "Agent not found",
  code: "NOT_FOUND",
  statusCode: 404,
  path: "/api/v1/agents/abc",
  method: "GET"
}
[DEBUG] 2026-07-20T12:00:00.000Z - [AgentFactory] cache hit { agentId: "xyz" }
```

## Debug Logging

Debug logs are only printed when:

```javascript
process.env.DEBUG || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
```

Set `DEBUG=true` in `.env` to enable debug logging in any environment.

## Request Logging

Every HTTP request is logged automatically by middleware in `src/index.js`:

```
GET /api/v1/agents/abc → 200 (15ms)
POST /api/v1/agents {"name":"test"} → 201 (120ms)
```

Format includes:
- HTTP method
- Original URL with query params (if any)
- Response status code
- Response time in milliseconds

## Logger Service

```javascript
import { loggerService } from '../../utils/index.js';

// Get logger instance
const logger = loggerService.getLogger();

// Log messages
logger.info('Starting process...');
logger.warn('Configuration missing', { key: 'PORT' });
logger.error('Operation failed', error);
logger.debug('Verbose details', { data: complexObject });
```

## Swapping Logger Implementation

The logger can be swapped by calling `loggerService.setLogger()` with a new implementation that exposes `info()`, `warn()`, `error()`, and `debug()` methods:

```javascript
import { loggerService } from '../../utils/index.js';
import CustomLogger from './CustomLogger.js';

loggerService.setLogger(new CustomLogger());
```

## Best Practices

1. **Log context** — Include relevant IDs (userId, agentId, entityId) in log messages
2. **Don't log secrets** — Never log API keys, tokens, or passwords
3. **Use appropriate levels** — `info` for normal ops, `warn` for recoverable issues, `error` for failures
4. **Structured data** — Pass structured data as the second argument, not concatenated in the message string
5. **Log at boundaries** — Log at service boundaries (creation, update, deletion) and at error points
6. **No sensitive data** — In production, ensure no PII is logged without consent

## Log Volume

The AG-UI module produces high-volume debug logs during streaming. These use `logger.debug()` and are hidden in production by default.
