# Mail Module

## Purpose

Handles **transactional email sending** using **Resend** for delivery and **Mailgen** for HTML email generation.

## Location

`src/modules/mail/`

## Structure

```
src/modules/mail/
├── index.js            # Barrel exports
└── mail.service.js     # Email sending functions
```

## Responsibilities

- Send verification emails with OTP codes
- Send welcome emails on account verification
- Send password reset emails with OTP codes
- Graceful fallback when Resend is not configured

## Email Templates

### Verification Email
Sent when a user registers and needs to verify their email address.

- **Template:** Mailgen with OTP code button
- **Subject:** "Verify your Persona.ai account"
- **Includes:** Verification code, expiry notice (10 minutes)

### Welcome Email
Sent after successful email verification.

- **Template:** Mailgen with "Get Started" button
- **Subject:** "Welcome to Persona.ai!"
- **Includes:** Link to the platform

### Password Reset Email
Sent when a user requests a password reset.

- **Template:** Mailgen with OTP code button
- **Subject:** "Reset your Persona.ai password"
- **Includes:** Reset code, expiry notice (10 minutes)

## Configuration

```env
RESEND_API_KEY=re_...           # Required for email sending
MAIL_FROM=Persona.ai <noreply@persona.hasanraiyan.me>  # Sender address
WEBSITE_URL=https://persona.hasanraiyan.me/  # Used in email links
```

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| Config | Internal | Resend API key, sender address, website URL |
| `resend` | External | Email delivery service |
| `mailgen` | External | HTML email template generation |

## Important Notes

- If `RESEND_API_KEY` is not configured, the service logs a warning and skips email sending (degraded but not broken)
- OTP codes expire in 10 minutes
- Plain-text email fallbacks are generated alongside HTML versions
