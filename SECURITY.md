# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in trails.cool, please report it
responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email: **security@trails.cool**

Include:
- Description of the vulnerability
- Steps to reproduce
- Impact assessment (what could an attacker do?)
- Any suggested fixes

We will acknowledge your report within 48 hours and provide a timeline for
a fix. We aim to resolve critical vulnerabilities within 7 days.

## Scope

The following are in scope:
- trails.cool and planner.trails.cool (production)
- The trails-cool/trails GitHub repository
- Authentication, authorization, and session management
- Data exposure or leakage
- Server-side vulnerabilities

The following are out of scope:
- Denial of service attacks
- Social engineering
- Self-hosted instances (report to the instance operator)
- Issues in third-party dependencies (report upstream)

## Security Practices

- **Authentication**: Passkey (WebAuthn) + magic link login. No passwords stored.
- **Cookies**: httpOnly, secure, sameSite=lax
- **Database**: Parameterized queries via Drizzle ORM (no raw SQL)
- **Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **CI**: Gitleaks secret scanning, dependency auditing
- **Docker**: Non-root containers
- **Monitoring**: Sentry error tracking, fail2ban SSH protection
