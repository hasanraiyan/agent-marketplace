# Route Documentation & Verification Checklist

This file tracks all API routes, their documentation status, verification (testing) status, and any notes.

## Routes

| Method | Path                            | Description                                        | Docs Exists?    | Verified? | Notes                                                                                           |
| ------ | ------------------------------- | -------------------------------------------------- | --------------- | --------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/`                             | Root endpoint - welcome message                    | Yes (README.md) | Yes       | Tested in `tests/root.test.js`. Documentation path is correct.                                  |
| GET    | `/api/v1/health`                | Health check endpoint (server status)              | Yes (README.md) | Yes       | Tested in `tests/health.integration.test.js`. Documentation path is outdated (shows `/health`). |
| GET    | `/api/v1/health/db`             | Database health check endpoint                     | Yes (README.md) | Yes       | Tested in `tests/dbHealth.test.js`. Documentation path is outdated (shows `/health/db`).        |
| POST   | `/api/v1/auth/register`         | Register user + send verification OTP via email    | Yes (plan.md)   | Partial   | Unit tests exist (`authController.test.js`) but integration tests?                              |
| POST   | `/api/v1/auth/login`            | Login, return access + refresh tokens              | Yes (plan.md)   | Partial   | Unit tests exist                                                                                |
| POST   | `/api/v1/auth/logout`           | Clear refresh token from DB (requires auth)        | Yes (plan.md)   | Partial   | Unit tests exist                                                                                |
| POST   | `/api/v1/auth/verify-email-otp` | Submit 6-digit OTP to verify email (requires auth) | Yes (plan.md)   | Partial   | Unit tests exist                                                                                |
| POST   | `/api/v1/auth/resend-otp`       | Resend verification OTP (requires auth)            | Yes (plan.md)   | Partial   | Unit tests exist                                                                                |
| POST   | `/api/v1/auth/forgot-password`  | Send 6-digit reset OTP to email                    | Yes (plan.md)   | Partial   | Unit tests exist                                                                                |
| POST   | `/api/v1/auth/reset-password`   | Submit OTP + new password to reset                 | Yes (plan.md)   | Partial   | Unit tests exist                                                                                |

## Legend

- **Docs Exists?**: Whether the route is documented in `docs/plan.md` or other documentation.
- **Verified?**: Whether the route has been tested (unit/integration) and passes.
- **Notes**: Additional comments, test coverage, or issues.

## Verification Status Details

- **Yes**: Route has passing tests (unit + integration).
- **Partial**: Some tests exist but may not cover all edge cases, or only unit tests.
- **No**: No tests yet.

## Next Steps

1. Ensure all routes have integration tests.
2. Update documentation with detailed request/response examples.
3. Verify authentication requirements for each route.
4. Add OpenAPI/Swagger documentation.

## Changelog

- 2026-03-30: Created checklist after adding `/api/v1` prefix to routes.
- 2026-03-30: Updated test paths for health endpoints.
