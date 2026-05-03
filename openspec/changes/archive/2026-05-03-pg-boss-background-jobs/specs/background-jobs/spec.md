## ADDED Requirements

### Requirement: Job queue initialization
The `@trails-cool/jobs` package SHALL initialize a pg-boss instance using the app's `DATABASE_URL` and export a function to start the worker.

#### Scenario: Worker starts with server
- **WHEN** the planner or journal server starts
- **THEN** pg-boss connects to PostgreSQL, creates/migrates the `pgboss` schema if needed, and begins polling for jobs

#### Scenario: Worker stops on shutdown
- **WHEN** the server process receives SIGTERM
- **THEN** pg-boss completes any in-progress jobs and stops gracefully before the process exits

### Requirement: Cron job scheduling
The system SHALL support registering recurring jobs with cron expressions.

#### Scenario: Register a cron job
- **WHEN** a job is registered with a cron expression (e.g., `0 * * * *` for hourly)
- **THEN** pg-boss creates a schedule that enqueues the job at the specified interval

#### Scenario: Cron job survives restart
- **WHEN** the server process restarts
- **THEN** existing cron schedules persist and continue firing without re-registration conflicts

### Requirement: Job retry policy
Jobs SHALL support configurable retry policies with exponential backoff.

#### Scenario: Transient failure retry
- **WHEN** a job handler throws an error
- **THEN** pg-boss retries the job up to the configured retry limit with exponential backoff

#### Scenario: Permanent failure
- **WHEN** a job exhausts all retries
- **THEN** the job moves to the `failed` state and remains queryable for debugging

### Requirement: Job handler timeout
Each job handler SHALL have a configurable execution timeout.

#### Scenario: Job exceeds timeout
- **WHEN** a job handler does not complete within its timeout
- **THEN** pg-boss marks the job as failed with a timeout error
