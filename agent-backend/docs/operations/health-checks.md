# Health Checks

## Endpoints

### Server Health

```
GET /api/v1/health
```

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Health check successful",
  "data": {
    "status": "healthy",
    "uptime": 12345.67,
    "timestamp": "2026-07-20T12:00:00.000Z"
  },
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```

### Database Health

```
GET /api/v1/health/db
```

Response (connected):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Database health check successful",
  "data": {
    "status": "healthy",
    "uptime": 12345.67,
    "timestamp": "2026-07-20T12:00:00.000Z"
  },
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```

Response (disconnected) — returns 503:

```json
{
  "success": false,
  "statusCode": 503,
  "message": "Database is disconnected",
  "code": "SERVICE_UNAVAILABLE",
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```

### Root Endpoint

```
GET /
```

Shows basic API info including DB status:

```json
{
  "message": "Welcome to persona.hasanraiyan.me API",
  "version": "1.0.0",
  "database": "connected"
}
```

## Monitoring Configuration

For load balancers and orchestration platforms:

| Endpoint | Recommended Interval | Expected Status |
|----------|--------------------|-----------------|
| `GET /api/v1/health` | 30 seconds | 200 |
| `GET /api/v1/health/db` | 60 seconds | 200 |

## Health Check Characteristics

- **No authentication required** — health endpoints are public
- **No rate limiting** — health checks bypass rate limits
- **Fast response** — health checks are lightweight (uptime is in-memory, DB check is a simple connection status read)
- **No caching** — All responses include `Cache-Control: no-store`

## Integration Examples

### Docker Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1
```

### Kubernetes Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /api/v1/health/db
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 30
```

### AWS Target Group Health Check

- **Path:** `/api/v1/health`
- **Port:** 3000
- **Healthy threshold:** 2
- **Unhealthy threshold:** 3
- **Timeout:** 5 seconds
- **Interval:** 30 seconds
