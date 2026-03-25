## 1. Caddy Security Headers

- [ ] 1.1 Add security headers block to Caddyfile: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- [ ] 1.2 Add Content-Security-Policy header (permissive initial policy allowing React Router inline scripts, OSM tiles, Sentry, WebSocket)
- [ ] 1.3 Test headers with securityheaders.com or curl after deploy

## 2. Scanner Blocking

- [ ] 2.1 Add Caddy path matcher for common scanner targets (.env*, .git*, wp-*, admin*, config.*, backup*)
- [ ] 2.2 Return 403 for matched paths before reverse_proxy
- [ ] 2.3 Verify scanner paths return 403, normal paths still work

## 3. CI Secret Scanning

- [ ] 3.1 Add gitleaks/gitleaks-action@v2 step to CI workflow
- [ ] 3.2 Create .gitleaks.toml with allowlist for Sentry DSNs (public values)
- [ ] 3.3 Verify gitleaks passes on current codebase

## 4. Dependency Auditing

- [ ] 4.1 Add `pnpm audit --audit-level=high` step to CI workflow
- [ ] 4.2 Create .github/dependabot.yml for weekly pnpm dependency updates
- [ ] 4.3 Verify pnpm audit passes on current codebase

## 5. Docker Hardening

- [ ] 5.1 Add non-root user to Journal Dockerfile runtime stage
- [ ] 5.2 Add non-root user to Planner Dockerfile runtime stage
- [ ] 5.3 Add non-root user to BRouter Dockerfile
- [ ] 5.4 Test containers start and serve correctly as non-root

## 6. Server Hardening

- [ ] 6.1 Install and configure fail2ban on Hetzner server (SSH protection)
- [ ] 6.2 Configure UFW firewall (allow 22, 80, 443 only)
- [ ] 6.3 Document server hardening steps in deployment docs

## 7. Documentation

- [ ] 7.1 Create SECURITY.md with vulnerability disclosure policy and security contact
- [ ] 7.2 Update privacy manifest with security practices documented

## 8. Verify

- [ ] 8.1 Run securityheaders.com scan on trails.cool and planner.trails.cool
- [ ] 8.2 Verify scanner paths return 403 in production
- [ ] 8.3 Verify CI passes with all new scanning steps
- [ ] 8.4 Verify Docker containers run as non-root
