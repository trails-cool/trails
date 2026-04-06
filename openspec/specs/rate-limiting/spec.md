## Purpose

Request rate limiting for Planner session creation and BRouter API calls to prevent abuse.

## Requirements

### Requirement: Session creation rate limit
The Planner SHALL limit session creation to 10 per IP per hour.

#### Scenario: Rate limit exceeded
- **WHEN** an IP creates more than 10 sessions in one hour
- **THEN** the server responds with 429 Too Many Requests

### Requirement: BRouter call rate limit
The Planner SHALL limit route computations to 60 per session per hour.

#### Scenario: Routing rate limit exceeded
- **WHEN** a session exceeds 60 BRouter calls in one hour
- **THEN** the server responds with 429 and the client shows a "slow down" message
