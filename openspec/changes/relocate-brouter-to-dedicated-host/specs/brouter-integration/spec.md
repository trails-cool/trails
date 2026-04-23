## MODIFIED Requirements

### Requirement: BRouter API proxy
The Planner backend SHALL proxy all BRouter API calls. Clients SHALL NOT communicate with BRouter directly. The proxy SHALL attach a `X-BRouter-Auth: <token>` header to every upstream request using the `BROUTER_AUTH_TOKEN` environment variable.

#### Scenario: Proxied route request
- **WHEN** the routing host client requests a route computation
- **THEN** the Planner backend forwards the request to BRouter over the configured upstream URL with the `X-BRouter-Auth` header set, applies rate limiting, and returns the response

#### Scenario: Missing auth token at startup
- **WHEN** the Planner starts in production without `BROUTER_AUTH_TOKEN` set
- **THEN** the Planner logs a fatal error and refuses to start

### Requirement: BRouter Docker deployment
BRouter SHALL run as a Docker container on a dedicated Hetzner host reached over a private Hetzner vSwitch, with planet-wide RD5 segments mounted as a volume. The BRouter container SHALL NOT be exposed on any public network interface.

#### Scenario: BRouter container starts
- **WHEN** the `docker compose up -d` command runs in `~trails/brouter/` on the dedicated host
- **THEN** the BRouter container is reachable only on the vSwitch-bound IP and can compute routes using the mounted planet-wide RD5 segments

#### Scenario: Public network isolation
- **WHEN** a request is sent to the dedicated host's public IP on the BRouter port
- **THEN** the request is refused at the host firewall or times out; BRouter does not respond

#### Scenario: JVM memory sizing
- **WHEN** the BRouter container starts
- **THEN** the JVM is launched with `-Xmx8g` (or equivalent) so that the heap does not exceed 8 GB on the 32 GB host

## ADDED Requirements

### Requirement: Shared-secret auth on BRouter
The BRouter deployment SHALL require a shared-secret header on every request. Requests without a valid `X-BRouter-Auth` header SHALL be rejected before reaching the BRouter process.

#### Scenario: Valid token
- **WHEN** a request arrives at the BRouter host with the correct `X-BRouter-Auth` header
- **THEN** the Caddy sidecar forwards the request to BRouter and returns its response

#### Scenario: Missing or wrong token
- **WHEN** a request arrives without an `X-BRouter-Auth` header or with an incorrect value
- **THEN** the Caddy sidecar responds with HTTP 403 and does not forward the request to BRouter

#### Scenario: Token not logged
- **WHEN** Caddy emits an access log line for a BRouter request
- **THEN** the `X-BRouter-Auth` header value is redacted or omitted from the log line
