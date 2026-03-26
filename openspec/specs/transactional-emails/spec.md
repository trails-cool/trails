## Requirements

### Requirement: Email sending interface
The system SHALL provide a provider-agnostic email sending function that supports HTML and plain-text content.

#### Scenario: Send email in production
- **WHEN** the system sends a transactional email in production
- **THEN** the email is delivered via the configured provider (Resend) to the recipient

#### Scenario: Dev mode skips sending
- **WHEN** the system sends a transactional email in development
- **THEN** the email content is logged to console and no external API is called

### Requirement: Magic link email
The system SHALL send an email containing the magic link when a user requests passwordless login.

#### Scenario: Magic link delivered
- **WHEN** a user requests a magic link login
- **THEN** an email is sent with a clickable link that logs them in

#### Scenario: Email content
- **WHEN** a magic link email is sent
- **THEN** it includes: the link, expiry time (15 minutes), and plain-text fallback

### Requirement: Welcome email
The system SHALL send a welcome email after successful registration.

#### Scenario: Welcome on registration
- **WHEN** a user completes passkey registration
- **THEN** a welcome email is sent to their registered email address

### Requirement: Email templates
Each email type SHALL have an HTML template with a plain-text fallback.

#### Scenario: Extensible template pattern
- **WHEN** a new email type is needed in the future
- **THEN** it can be added by creating a template function and calling sendEmail

### Requirement: Privacy disclosure
Email sending SHALL be documented in the privacy manifest.

#### Scenario: Privacy manifest updated
- **WHEN** transactional emails are enabled
- **THEN** the /privacy page documents: what emails are sent, that email addresses are shared with the email provider, and which provider is used
