# Auth System Plan — Agent Marketplace Backend

## Stack

- **Express 5.2.1** (ESM)
- **MongoDB + Mongoose 9**
- **JWT** via `jsonwebtoken`
- **Password/OTP hashing** via `bcrypt`
- **Email sending** via `resend`
- **Email templates** via `mailgen`
- **Validation** via `zod`

---

## Dependencies Installed

```
pnpm add jsonwebtoken bcrypt resend mailgen
```

this is completed see @package.json

---

## Files to Create

| File                                 | Purpose                                                      |
| ------------------------------------ | ------------------------------------------------------------ |
| `src/config/jwt.config.js`           | JWT secret, expiry from env                                  |
| `src/config/mail.config.js`          | Resend client init + Mailgen instance                        |
| `src/middlewares/auth.middleware.js` | `verifyToken` middleware (protect routes)                    |
| `src/controllers/auth.controller.js` | All auth controller logic                                    |
| `src/services/auth.service.js`       | Token generation, password hashing, OTP generation + hashing |
| `src/services/mail.service.js`       | Send verification OTP email, send reset OTP email            |
| `src/validators/auth.validator.js`   | Zod schemas for all auth inputs                              |
| `src/routes/auth.routes.js`          | All auth routes                                              |

---

## Files to Edit

| File                  | Changes                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/models/User.js`  | Add auth fields (password, OTP fields, refreshToken, emailVerified) + pre-save bcrypt hook                        |
| `src/config/index.js` | Add JWT + Resend env vars to config object                                                                        |
| `.env.example`        | Add `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`, `RESEND_API_KEY`, `MAIL_FROM` |
| `.env`                | Add actual values for the above                                                                                   |
| `src/index.js`        | Mount auth routes                                                                                                 |

---

## User Model — New Fields

```js
password: {
  type: String,
  required: true,
  select: false,        // excluded from queries by default
},
emailVerified: {
  type: Boolean,
  default: false,
},
emailVerificationOTP: {
  type: String,
  select: false,
},
emailVerificationOTPExpires: {
  type: Date,
  select: false,
},
passwordResetOTP: {
  type: String,
  select: false,
},
passwordResetOTPExpires: {
  type: Date,
  select: false,
},
refreshToken: {
  type: String,
  select: false,
},
```

---

## Routes

| Method | Path                     | Auth? | Description                                     |
| ------ | ------------------------ | ----- | ----------------------------------------------- |
| POST   | `/auth/register`         | No    | Register user + send verification OTP via email |
| POST   | `/auth/login`            | No    | Login, return access + refresh tokens           |
| POST   | `/auth/logout`           | Yes   | Clear refresh token from DB                     |
| POST   | `/auth/verify-email-otp` | Yes   | Submit 6-digit OTP to verify email              |
| POST   | `/auth/resend-otp`       | Yes   | Resend verification OTP                         |
| POST   | `/auth/forgot-password`  | No    | Send 6-digit reset OTP to email                 |
| POST   | `/auth/reset-password`   | No    | Submit OTP + new password to reset              |

---

## Auth Flow (OTP Based)

### 1. Register

- Validate input (name, email, password)
- Check if email already exists
- Hash password with bcrypt
- Generate 6-digit OTP
- Hash OTP, store hash + 10 min expiry in DB
- Save user
- Send OTP to email via Resend + Mailgen template
- Return success message

### 2. Login

- Validate input (email, password)
- Find user, check password with bcrypt.compare
- If email not verified → return error
- Generate accessToken (short-lived) + refreshToken (long-lived)
- Store refreshToken in DB
- Return both tokens + user data

### 3. Logout

- Clear refreshToken from DB
- Return success message

### 4. Verify Email OTP

- Validate input (email, otp)
- Find user, compare OTP with bcrypt
- Check OTP expiry
- Mark `emailVerified: true`
- Clear OTP fields
- Return success

### 5. Resend OTP

- Find user by email (must be authenticated)
- Generate new 6-digit OTP, hash it
- Update DB with new hash + expiry
- Send new OTP email
- Return success

### 6. Forgot Password

- Validate input (email)
- Find user by email
- Generate 6-digit OTP, hash it
- Store hash + 10 min expiry in DB
- Send reset OTP email
- Return success

### 7. Reset Password

- Validate input (email, otp, newPassword)
- Find user by email
- Compare OTP with bcrypt, check expiry
- Hash new password
- Save, clear OTP fields
- Return success

---

## Config Files

### `src/config/jwt.config.js`

```js
const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};
```

### `src/config/mail.config.js`

```js
// Resend client instance
// Mailgen instance (theme + product info)
```

---

## Email Templates (Resend + Mailgen)

### Verification Email

- Subject: "Verify your Agent Marketplace account"
- Body: "Your verification code is **XXXXXX**. It expires in 10 minutes."

### Password Reset Email

- Subject: "Reset your Agent Marketplace password"
- Body: "Your password reset code is **XXXXXX**. It expires in 10 minutes."

---

## Env Vars Needed

```env
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d
RESEND_API_KEY=re_xxxxxxxxxxxx
MAIL_FROM=Agent Marketplace <noreply@yourdomain.com>
```

---

## Architecture Notes

- Follow existing ESM import/export style
- Use existing `BaseError` → `ValidationError` / `NotFoundError` pattern for errors
- Use existing `validateBody` middleware from `validationMiddleware.js`
- Use existing `successFormatter` for responses
- OTP stored as bcrypt hash in DB (never plain text)
- `select: false` on sensitive fields (password, tokens, OTPs)
