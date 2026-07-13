## ADDED Requirements

### Requirement: Durable federation queue
Fedify's message queue SHALL be backed by PostgreSQL so that queued activities, inbox processing tasks, and retry state survive process restarts and deploys.

#### Scenario: Delivery survives a restart
- **WHEN** deliveries are queued and the journal container restarts before they complete
- **THEN** the deliveries execute after restart without loss

#### Scenario: Retry state persists
- **WHEN** a delivery has failed twice with backoff pending and the process restarts
- **THEN** the retry continues on schedule rather than starting over or disappearing

### Requirement: Inbound replay defense
The Journal SHALL record processed inbound activity IRIs (retained at least 30 days) and SHALL drop duplicate activities idempotently before any side effects.

#### Scenario: Replayed activity is a no-op
- **WHEN** the same signed Like activity is delivered twice
- **THEN** the second delivery produces no state change and is counted as a dropped duplicate

### Requirement: Instance blocklist
The Journal SHALL support blocking federation instances by domain, enforced at inbox processing (activities dropped without an error oracle), delivery enqueue (recipients filtered), and outbox polling/actor fetch (refused). Blocking SHALL be manageable via a documented operator procedure.

#### Scenario: Blocked instance is inert in both directions
- **WHEN** a domain is added to the blocklist
- **THEN** its activities are silently dropped, no deliveries are sent to it, and its actors/outboxes are not fetched

### Requirement: Published federation protocol documentation
The repository SHALL contain a `FEDERATION.md` documenting actor discovery, object and activity types with JSON examples, addressing rules, signature and deduplication expectations, delivery retry policy, and moderation semantics, kept current as federation capabilities change.

#### Scenario: Third-party implementer can interoperate
- **WHEN** another project implements against `FEDERATION.md`
- **THEN** the documented flows (follow, create fan-out, dedup) behave as described

### Requirement: Federation delivery observability
The Journal SHALL expose metrics for delivery outcomes, queue depth, and inbox drops (duplicate/blocked), surfaced on the monitoring dashboard.

#### Scenario: Operator sees delivery health
- **WHEN** deliveries to an unreachable instance keep failing
- **THEN** failure counts and queue depth are visible on the dashboard
