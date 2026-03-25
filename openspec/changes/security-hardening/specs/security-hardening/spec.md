## ADDED Requirements

### Requirement: Security response headers
All HTTP responses SHALL include security headers to protect against common web attacks.

#### Scenario: HSTS header
- **WHEN** a browser receives a response from trails.cool
- **THEN** the response includes `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

#### Scenario: Content sniffing prevention
- **WHEN** a browser receives a response
- **THEN** the response includes `X-Content-Type-Options: nosniff`

#### Scenario: Clickjacking prevention
- **WHEN** a browser receives a response
- **THEN** the response includes `X-Frame-Options: DENY`

### Requirement: Scanner path blocking
Known vulnerability scanner paths SHALL be blocked at the reverse proxy level before reaching the application.

#### Scenario: Env file scanner
- **WHEN** a request is made to `/.env`, `/.env.local`, `/.env.prod`, or similar paths
- **THEN** Caddy returns 403 without forwarding to the application

#### Scenario: Git config scanner
- **WHEN** a request is made to `/.git/config` or `/.git/HEAD`
- **THEN** Caddy returns 403 without forwarding to the application

### Requirement: Secret scanning in CI
The CI pipeline SHALL scan commits for accidentally committed secrets.

#### Scenario: Secret detected
- **WHEN** a PR contains a committed API key, token, or password
- **THEN** the CI pipeline fails with a clear message indicating the leaked secret

#### Scenario: Known public values allowed
- **WHEN** a known-public value (e.g., Sentry DSN) is committed
- **THEN** gitleaks allows it via the `.gitleaks.toml` allowlist

### Requirement: Dependency vulnerability scanning
The CI pipeline SHALL check for known vulnerabilities in dependencies.

#### Scenario: High severity vulnerability
- **WHEN** a dependency has a high or critical vulnerability advisory
- **THEN** the CI pipeline fails

### Requirement: Non-root Docker containers
Application containers SHALL run as a non-root user.

#### Scenario: Container user
- **WHEN** a container starts
- **THEN** the process runs as a non-root user (not UID 0)

### Requirement: Vulnerability disclosure policy
The repository SHALL include a SECURITY.md with responsible disclosure instructions.

#### Scenario: Security contact
- **WHEN** a security researcher finds a vulnerability
- **THEN** SECURITY.md provides clear instructions for reporting it
