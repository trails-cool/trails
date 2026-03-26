## MODIFIED Requirements

### Requirement: Magic link login
The magic link login flow SHALL deliver the link via email in production instead of logging to console.

#### Scenario: Production email delivery
- **WHEN** a user requests a magic link in production
- **THEN** the link is emailed to the user (not just logged to console)

#### Scenario: Dev mode unchanged
- **WHEN** a user requests a magic link in development
- **THEN** the link is returned directly for auto-redirect (existing behavior preserved)
