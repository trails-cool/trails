## 1. Email Infrastructure

- [ ] 1.1 Add `resend` package to Journal dependencies
- [ ] 1.2 Create `apps/journal/app/lib/email.server.ts` with sendEmail(to, subject, html, text) — uses Resend in production, logs to console in dev
- [ ] 1.3 Add `RESEND_API_KEY` env var to docker-compose.yml
- [ ] 1.4 Write unit test for sendEmail (mock Resend, verify dev-mode logging)

## 2. Email Templates

- [ ] 2.1 Create magicLinkTemplate(link: string) returning { html, text } — includes link, 15-min expiry note, trails.cool branding
- [ ] 2.2 Create welcomeTemplate(username: string) returning { html, text } — greeting, what they can do, link to routes
- [ ] 2.3 Wire sendMagicLink(email, link) and sendWelcome(email, username) helper functions

## 3. Integration

- [ ] 3.1 Update api.auth.login.ts: call sendMagicLink in production instead of just logging
- [ ] 3.2 Update registration flow: call sendWelcome after successful passkey registration
- [ ] 3.3 Verify dev mode still works (devLink returned, no email sent)

## 4. Privacy & Config

- [ ] 4.1 Update /privacy page: document email sending, provider (Resend), what data is shared
- [ ] 4.2 Add `RESEND_API_KEY` to CD secrets and deploy documentation
- [ ] 4.3 Document sender domain DNS setup (DKIM/SPF for noreply@trails.cool)

## 5. Verify

- [ ] 5.1 Test magic link email delivery locally with Resend test API key
- [ ] 5.2 Test welcome email on registration
- [ ] 5.3 Verify existing E2E tests still pass (dev mode unchanged)
