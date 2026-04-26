## ADDED Requirements

### Requirement: Public activity creation fans out notifications
Creating an activity with `visibility = 'public'` SHALL enqueue a fan-out job that inserts an `activity_published` notification for every accepted follower of the activity owner. The fan-out SHALL run asynchronously so the activity-creation request returns immediately.

#### Scenario: Public activity fans out
- **WHEN** a user with N accepted followers creates an activity with `visibility = 'public'`
- **THEN** a pg-boss job is enqueued, and on completion N notifications exist with `type = 'activity_published'`, `recipient_user_id` ∈ accepted-followers, `actor_user_id` = activity owner, `subject_id` = activity id

#### Scenario: Private or unlisted activity does not fan out
- **WHEN** a user creates an activity with `visibility = 'private'` or `'unlisted'`
- **THEN** no fan-out job is enqueued and no notifications are created

#### Scenario: No accepted followers means no notifications
- **WHEN** a user with zero accepted followers creates a public activity
- **THEN** the fan-out job runs and inserts zero rows
