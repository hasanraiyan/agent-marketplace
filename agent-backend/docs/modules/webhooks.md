# Webhooks Module

## Purpose

Handles **incoming webhooks** from external services. Currently processes Clerk user lifecycle events to keep the local MongoDB user database in sync.

## Location

`src/modules/webhooks/`

## Structure

```
src/modules/webhooks/
├── index.js                # Barrel exports
├── webhook.routes.js       # Webhook route definitions
├── webhook.controller.js   # Event handling logic
└── webhook.service.js      # User sync business logic
```

## Responsibilities

- Receive and verify Clerk webhook events
- Sync user creation, updates, and deletions to local MongoDB
- Handle event idempotency (skip duplicate creates)

## Webhook Events

### `user.created`

```javascript
{
  data: {
    id: "clerk_user_id",
    email_addresses: [{ email_address: "user@example.com" }],
    first_name: "John",
    last_name: "Doe",
    username: "johndoe"
  }
}
```

**Action:** Creates a new user record in MongoDB. Handles duplicate email gracefully (logs and continues if user already exists).

### `user.updated`

```javascript
{
  data: {
    id: "clerk_user_id",
    email_addresses: [{ email_address: "new@example.com" }],
    first_name: "John",
    last_name: "Smith",
    username: "johnsmith"
  }
}
```

**Action:** Updates the existing user record. Skips if user not found in local DB.

### `user.deleted`

```javascript
{
  data: {
    id: "clerk_user_id"
  }
}
```

**Action:** Deletes the user record from MongoDB. Skips if user not found.

## Route

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/webhooks/clerk` | Svix signature | Clerk webhook handler |

## Raw Body Parsing

Webhooks use `express.raw({ type: 'application/json' })` to preserve the raw request body for signature verification. This route is registered **before** Clerk middleware and `express.json()`.

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| Users module | Internal | User repository for DB operations |
| `svix` | External | Webhook signature verification |

## Important Business Rules

### Idempotency
The `user.created` handler checks for duplicate users by `clerkId` or email and skips creation if the user already exists, preventing duplicate records from webhook retries.

### Silent Skip
If a `user.updated` or `user.deleted` webhook arrives for a user that doesn't exist in the local database, it logs a warning and skips rather than throwing an error.

### Route Order
The webhook route is registered before Clerk middleware and `express.json()` in `src/index.js` to allow raw body parsing.
