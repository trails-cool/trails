## ADDED Requirements

### Requirement: Follow lifecycle emits notifications
The follow lifecycle SHALL produce notifications for the recipient of the social event (see `notifications` spec):

- Auto-accepted public follow → `follow_received` to the followed user.
- Approved Pending request → `follow_request_approved` to the follower (now accepted).
- Reject and unfollow do NOT produce notifications.

#### Scenario: Public auto-accept notifies the target
- **WHEN** a user follows another user whose `profile_visibility = 'public'` (auto-accept path)
- **THEN** a `follow_received` notification is created for the followed user

#### Scenario: Approval notifies the requester
- **WHEN** a private user approves a Pending follow request
- **THEN** a `follow_request_approved` notification is created for the follower

#### Scenario: Reject does not notify
- **WHEN** a private user rejects a Pending follow request
- **THEN** no notification is created (silent rejection — the follower can re-request later if they want)

#### Scenario: Unfollow does not notify
- **WHEN** a follower unfollows or cancels a Pending request
- **THEN** no notification is created on the followed side
