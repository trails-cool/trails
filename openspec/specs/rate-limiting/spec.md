## Purpose

Request rate limiting for Planner session creation and BRouter API calls to prevent abuse.

## Requirements

### Requirement: Session creation rate limit
The Planner SHALL limit session creation to 10 per IP per hour.

#### Scenario: Rate limit exceeded
- **WHEN** an IP creates more than 10 sessions in one hour
- **THEN** the server responds with 429 Too Many Requests

### Requirement: BRouter call rate limit
The Planner SHALL limit route computations to 300 per session per hour (the `DEFAULT_MAX_REQUESTS` value in `apps/planner/app/lib/rate-limit.ts`).

#### Scenario: Routing rate limit exceeded
- **WHEN** a session exceeds 300 BRouter calls in one hour
- **THEN** the server responds with 429 and the client shows a "slow down" message

### Requirement: Overpass API rate limit
The Planner SHALL limit Overpass API calls to 120 per IP per minute to protect the upstream service.

#### Scenario: Overpass rate limit exceeded
- **WHEN** a single IP exceeds 120 Overpass requests in one minute
- **THEN** the `/api/overpass` proxy responds with 429 Too Many Requests
