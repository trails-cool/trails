## MODIFIED Requirements

### Requirement: Service configuration
Each service SHALL be configured with security best practices including non-root execution and security headers.

#### Scenario: Caddy security headers
- **WHEN** Caddy proxies a request
- **THEN** it adds HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy headers

#### Scenario: Caddy scanner blocking
- **WHEN** a request matches known scanner paths (.env, .git, wp-config, etc.)
- **THEN** Caddy returns 403 without forwarding to the application

### Requirement: CI/CD pipeline
GitHub Actions SHALL include security scanning steps alongside build and test.

#### Scenario: Gitleaks scan
- **WHEN** a PR is opened
- **THEN** gitleaks scans for committed secrets

#### Scenario: Dependency audit
- **WHEN** CI runs
- **THEN** pnpm audit checks for high/critical vulnerabilities
