## Why

A security audit found several gaps: no security headers (HSTS, CSP, etc.),
no secret scanning in CI, no dependency vulnerability scanning, Docker
containers running as root, and bot scanners probing for `.env` files with
no filtering. The cookie and auth setup is solid, but the infrastructure and
CI layers need hardening.

## What Changes

- **Security headers**: HSTS, X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, Permissions-Policy via Caddyfile
- **Content-Security-Policy**: Restrict script/style/font sources
- **Gitleaks**: Secret scanning in CI to prevent credential leaks
- **Dependency auditing**: `pnpm audit` in CI + Dependabot for automated updates
- **Docker hardening**: Non-root user in all Dockerfiles
- **Bot/scanner blocking**: Caddy matcher to reject known scanner paths
  (`.env`, `.git`, `wp-config`, etc.) with 403 before hitting the app
- **Fail2ban or equivalent**: Rate-limit SSH brute force and scanner IPs
  at the server level
- **SECURITY.md**: Vulnerability disclosure policy

## Capabilities

### New Capabilities

- `security-hardening`: Security headers, CI secret/dependency scanning,
  Docker non-root, scanner blocking, server-level rate limiting

### Modified Capabilities

- `infrastructure`: Caddy security headers + scanner blocking, Docker non-root,
  Terraform firewall adjustments, CI scanning steps

## Impact

- **Caddyfile**: Security headers + scanner path blocking
- **Dockerfiles**: Add non-root user (journal, planner, brouter)
- **CI**: Add gitleaks step, pnpm audit step
- **Repo**: Add `.gitleaks.toml`, `dependabot.yml`, `SECURITY.md`
- **Server**: Optional fail2ban or UFW configuration
- **Dependencies**: None for app code; gitleaks is a CI action
