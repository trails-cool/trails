## ADDED Requirements

### Requirement: Pending state on Follow button
When a signed-in viewer has an outgoing follow against a profile that is `accepted_at IS NULL` (awaiting `Accept(Follow)` from the remote), the Follow button SHALL render in a Pending state with a cancel option, distinct from both the unfollowed and followed states.

#### Scenario: Pending state visible
- **WHEN** a signed-in user has just initiated a follow against a remote trails actor's profile
- **THEN** the profile page renders a "Pending" indicator with a cancel-request control instead of the Follow or Unfollow button
