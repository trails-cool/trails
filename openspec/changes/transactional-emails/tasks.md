## 1. Email Infrastructure

- [x] 1.1 Add `nodemailer` package to Journal dependencies
- [x] 1.2 Create `apps/journal/app/lib/email.server.ts` with sendEmail(to, subject, html, text) — uses SMTP in production, logs to console in dev
- [x] 1.3 Add `SMTP_URL` and `SMTP_FROM` env vars to docker-compose.yml
- [x] 1.4 Write unit test for sendEmail (mock nodemailer, verify dev-mode logging)

## 2. Email Templates

- [x] 2.1 Create magicLinkTemplate(link: string) returning { html, text } — includes link, 15-min expiry note, trails.cool branding
- [x] 2.2 Create welcomeTemplate(username: string) returning { html, text } — greeting, what they can do, link to routes
- [x] 2.3 Wire sendMagicLink(email, link) and sendWelcome(email, username) helper functions

## 3. Integration

- [x] 3.1 Update api.auth.login.ts: call sendMagicLink in production instead of just logging
- [x] 3.2 Update registration flow: call sendWelcome after successful passkey registration
- [x] 3.3 Verify dev mode still works (devLink returned, no email sent)

## 4. Privacy & Config

- [x] 4.1 Update /privacy page: document email sending, provider (Resend), what data is shared
- [x] 4.2 Add `SMTP_URL` to server env and deploy documentation
- [x] 4.3 Document sender domain DNS setup (SPF/DKIM/DMARC for noreply@trails.cool)

## 5. Verify

- [x] 5.1 Test magic link email delivery locally with SMTP
- [x] 5.2 Test welcome email on registration
- [x] 5.3 Verify existing E2E tests still pass (dev mode unchanged)
