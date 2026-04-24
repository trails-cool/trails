## ADDED Requirements

### Requirement: BRouter access control
The BRouter service SHALL be reachable only from the flagship host over a private Hetzner vSwitch, and every request SHALL carry a valid `X-BRouter-Auth` shared-secret header. The token SHALL be stored only in SOPS-encrypted secrets and GitHub Actions secrets, never committed in cleartext.

#### Scenario: Request from public internet
- **WHEN** an attacker sends a request to the BRouter host's public IP on the BRouter service port
- **THEN** the host firewall refuses the connection

#### Scenario: Request from vSwitch without token
- **WHEN** a request arrives on the BRouter host over the vSwitch without a valid `X-BRouter-Auth` header
- **THEN** the Caddy sidecar responds with HTTP 403 and BRouter never sees the request

#### Scenario: Token storage
- **WHEN** `BROUTER_AUTH_TOKEN` is added or rotated
- **THEN** the token is written only to `infrastructure/secrets.infra.env` (SOPS-encrypted) and to the GitHub Actions secret store, and is never committed in cleartext to the repository

#### Scenario: Token rotation
- **WHEN** the token is rotated
- **THEN** operators update SOPS, redeploy the Planner (new token in outbound header), and redeploy the Caddy sidecar (new token in the matcher), in that order, with zero downtime
