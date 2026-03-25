## Why

Magic link login doesn't work in production — the link is logged to console
but never emailed to the user. Registration works (passkey-based) but the
fallback auth flow is broken. We need actual email delivery.

## What Changes

- Add a reusable email sending layer (`@trails-cool/email` or in-app module)
  with a provider-agnostic interface so future emails are trivial to add
- Send magic link emails in production
- Send a welcome email after registration
- Use a transactional email provider (Resend, Postmark, or SMTP)
- HTML email templates with plain-text fallback
- Document email sending in the privacy manifest

## Capabilities

### New Capabilities

- `transactional-emails`: Send templated emails via a provider-agnostic interface. Current emails: magic link login, welcome on registration. Designed for easy addition of future email types.

### Modified Capabilities

- `journal-auth`: Magic link flow now actually sends the email instead of logging to console

## Impact

- **Files**: New email module (lib or package), modified `api.auth.login.ts`, modified registration flow, email templates
- **Dependencies**: One email provider SDK (e.g., `resend` or `nodemailer`)
- **Infrastructure**: Email provider API key as env var, DNS records for sender domain verification
- **Privacy**: Email addresses sent to third-party email provider — must document
