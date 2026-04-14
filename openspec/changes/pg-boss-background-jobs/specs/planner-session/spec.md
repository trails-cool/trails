## MODIFIED Requirements

### Requirement: Session expiry
Open sessions with no activity for 7 days SHALL be automatically deleted by a scheduled background job.

#### Scenario: Stale session cleanup
- **WHEN** the hourly `expire-sessions` cron job runs
- **THEN** all sessions with `last_activity` older than 7 days are deleted from the database
- **AND** their Yjs documents are removed from memory

#### Scenario: Active session preserved
- **WHEN** the `expire-sessions` job runs
- **THEN** sessions with `last_activity` within the last 7 days are NOT deleted

#### Scenario: Cleanup is observable
- **WHEN** the `expire-sessions` job completes
- **THEN** the job output includes the count of expired sessions
- **AND** the result is visible in the Grafana job queue dashboard
