## Context

Security audit findings:
- ✅ Solid: cookies (httpOnly/secure/sameSite), auth (passkeys/JWT), SQL
  injection safe (Drizzle), XSS safe (React), rate limiting on Planner API
- ❌ Missing: security headers, CSP, secret scanning, dependency auditing,
  non-root Docker, scanner blocking, vulnerability disclosure policy
- ⚠️ Weak dev-secret fallbacks in code (`"dev-jwt-secret-change-in-production"`)

## Goals / Non-Goals

**Goals:**
- Security headers on all responses via Caddy
- Block known scanner paths at Caddy level (before hitting Node)
- Gitleaks in CI to catch committed secrets
- pnpm audit in CI to catch vulnerable dependencies
- Dependabot for automated dependency updates
- Non-root user in all Docker containers
- SECURITY.md for responsible disclosure

**Non-Goals:**
- WAF (web application firewall) — overkill for current scale
- CSRF tokens — current SameSite + JSON API pattern is sufficient
- Container image scanning (Trivy etc.) — add later
- mTLS between containers — Docker network is trusted
- Removing dev-secret fallbacks — they only activate when env vars are missing,
  which is a deployment bug, not a security issue

## Decisions

### D1: Security headers in Caddyfile

Add a `header` block to both site configs:
```
header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
}
```

CSP is tricky with React Router's inline scripts. Use a permissive initial
policy: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src
'self' 'unsafe-inline'; img-src 'self' data: https://*.tile.openstreetmap.org;
connect-src 'self' wss: https://*.sentry.io https://*.ingest.de.sentry.io;`

### D2: Scanner path blocking in Caddy

Add a `respond` directive before `reverse_proxy` that returns 403 for
common scanner paths:
```
@scanners path /.env* /.git* /wp-* /admin* /config.* /backup* /api/v1*
respond @scanners 403
```

This prevents the app from even seeing these requests — no Sentry noise,
no wasted compute.

### D3: Gitleaks via GitHub Action

Add `gitleaks/gitleaks-action@v2` as a CI step. It scans commits for secrets
(API keys, tokens, passwords). Runs on every PR. Add `.gitleaks.toml` for
any false-positive allowlists (e.g., Sentry DSNs are public).

### D4: pnpm audit in CI

Add `pnpm audit --audit-level=high` as a CI step. Fail only on high/critical
vulnerabilities to avoid noise from low-severity advisories. Run alongside
lint/typecheck.

### D5: Dependabot for pnpm

Create `.github/dependabot.yml` targeting pnpm ecosystem. Weekly schedule,
grouped by update type. Auto-creates PRs for outdated dependencies.

### D6: Non-root user in Dockerfiles

Add to the runtime stage of each Dockerfile:
```dockerfile
RUN addgroup --system app && adduser --system --ingroup app app
USER app
```

This limits the impact of container escape vulnerabilities. BRouter needs
read access to segments, which works since the volume is readable.

### D7: Fail2ban on the server

Install `fail2ban` on the Hetzner server to block IPs after repeated SSH
failures or scanner patterns. Configuration via Terraform user-data or
manual setup documented in deployment docs.

## Risks / Trade-offs

- **CSP with inline scripts** → React Router uses inline scripts for hydration.
  Must use `'unsafe-inline'` for `script-src`. Can tighten with nonce-based
  CSP later if React Router supports it.
- **Scanner blocking is path-based** → Won't catch all bots, but eliminates
  the most common credential-harvesting patterns.
- **Non-root may break file permissions** → Test that the app can still read
  build output and node_modules. Should work since COPY sets root ownership
  by default and files are world-readable.
