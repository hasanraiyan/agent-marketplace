# Users Module

## Purpose

Manages **user profiles, authentication sync, and admin functionality**. Handles user data storage, profile updates, authentication linking with Clerk, and administrative user management.

## Location

`src/modules/users/`

## Structure

```
src/modules/users/
├── index.js                # Barrel exports
├── user.model.js           # Mongoose schema + Zod schema
├── user.repository.js      # Database access
├── user.service.js         # Business logic
├── profile.routes.js       # User profile API routes
├── profile.controller.js   # Profile HTTP handlers
├── profile.validator.js    # Profile Zod validation schemas
├── admin.routes.js         # Admin API routes
├── admin.controller.js     # Admin HTTP handlers
└── admin.middleware.js     # Admin role authorization
```

## Responsibilities

- User profile CRUD (get, update, delete account)
- Clerk ID ↔ MongoDB user mapping
- Admin user management (list users, delete users)
- Admin role authorization middleware
- Profile data validation

## Data Model (User)

| Field | Type | Description |
|-------|------|-------------|
| `clerkId` | String (unique) | Clerk user identifier |
| `name` | String (2-100) | Display name |
| `email` | String (unique) | Email address |
| `username` | String (unique, sparse) | Optional username |
| `age` | Number (0-150) | Optional age |
| `isActive` | Boolean | Account active status |
| `role` | enum: normal/admin | User role |
| `profile` | Object | Profile preferences/summary |

## Public API

### Profile Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/v1/profile` | Required | Get own profile |
| `PATCH` | `/api/v1/profile` | Required | Update profile |
| `DELETE` | `/api/v1/profile` | Required | Delete own account |

### Admin Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/v1/admin/users` | Admin | List all users |
| `DELETE` | `/api/v1/admin/users/:id` | Admin | Delete a user |

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| Auth module | Internal | Authentication middleware |
| Rate Limiter module | Internal | Rate limiting (delete only) |

## Important Business Rules

### User Sync
Users are synced from Clerk during authentication (via `authService.syncUser()`) and through webhooks (via `webhookService.createUser()`). The local user record is the source of truth for application-level data (agents, threads, etc.), while Clerk is the source of truth for authentication.

### Admin Authorization
`adminMiddleware` checks that the authenticated user has `role: 'admin'`. This is used in addition to `authMiddleware`.

### Profile Update Validation
Profile updates are validated with Zod schemas (`updateProfileSchema`, `changePasswordSchema`, `deleteAccountSchema`).

### Account Deletion
Users can delete their own account. Admin users can delete any user account.
