## ADDED Requirements

### Requirement: Persistent staging instance
A persistent staging instance SHALL run at `staging.trails.cool` (journal) and `planner.staging.trails.cool` (planner), auto-deploying from main on every push.

#### Scenario: Deploy staging on main push
- **WHEN** a commit is pushed to main that changes `apps/` or `packages/`
- **THEN** the staging journal and planner containers are rebuilt and redeployed with the latest main

#### Scenario: Staging uses isolated database
- **WHEN** the staging instance is running
- **THEN** it uses the `trails_staging` database, separate from the production `trails` database

#### Scenario: Staging is accessible
- **WHEN** a user navigates to `https://staging.trails.cool`
- **THEN** they see the journal app served over HTTPS with a valid TLS certificate

### Requirement: PR preview environments
Ephemeral preview environments SHALL be created for each PR that changes app or package code.

#### Scenario: Preview created on PR open
- **WHEN** a PR is opened that changes files in `apps/` or `packages/`
- **THEN** a preview environment is deployed at `pr-<number>.staging.trails.cool` within 5 minutes
- **AND** a comment is posted on the PR with the preview URL

#### Scenario: Preview updated on PR push
- **WHEN** new commits are pushed to a PR branch with an active preview
- **THEN** the preview containers are rebuilt and redeployed with the latest branch code

#### Scenario: Preview torn down on PR close
- **WHEN** a PR is merged or closed
- **THEN** its preview containers are stopped and removed
- **AND** its database (`trails_pr_<number>`) is dropped

#### Scenario: Preview database isolation
- **WHEN** a PR preview is running
- **THEN** it uses a dedicated database `trails_pr_<number>` with schema applied via Drizzle Kit push

### Requirement: PR preview cleanup
A scheduled cleanup job SHALL remove orphaned preview resources from closed PRs.

#### Scenario: Stale preview cleanup
- **WHEN** the cleanup job runs
- **THEN** any preview containers or databases belonging to closed/merged PRs are removed

### Requirement: Resource limits
Staging and preview containers SHALL have resource limits to protect production.

#### Scenario: Memory limits enforced
- **WHEN** a staging or preview container is running
- **THEN** it has a memory limit of 256MB per app container

#### Scenario: Concurrent preview limit
- **WHEN** more than 3 PR previews are active
- **THEN** the oldest preview is torn down before the new one is created
