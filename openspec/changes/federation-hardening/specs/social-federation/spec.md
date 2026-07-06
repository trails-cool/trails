## MODIFIED Requirements

### Requirement: Push delivery on local activity create
The Journal SHALL deliver a `Create(Note)` activity to every accepted remote follower's inbox when a local user with `profile_visibility = 'public'` creates a new `public` activity. Delivery queueing and retry state SHALL be persistent: queued deliveries and scheduled retries survive process restarts.

#### Scenario: New public activity fans out
- **WHEN** a local user with N accepted remote followers creates a new public activity
- **THEN** N delivery jobs are enqueued (one per follower's inbox), each retrying with exponential backoff on 5xx, giving up after a documented retry budget

#### Scenario: Rate-limited per remote host
- **WHEN** multiple deliveries target the same remote host
- **THEN** they are rate-limited so we never exceed 1 request per second per remote host (configurable; chosen for safety, not throughput)

#### Scenario: Fan-out survives a deploy
- **WHEN** a deploy restarts the journal while fan-out deliveries are queued or awaiting retry
- **THEN** the deliveries complete after the restart without loss
