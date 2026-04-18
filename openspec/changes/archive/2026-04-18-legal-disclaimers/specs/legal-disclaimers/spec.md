## ADDED Requirements

### Requirement: Impressum page
The Journal SHALL serve an Impressum page at `/legal/imprint` containing the operator's legal information per §5 TMG and §18 MStV.

#### Scenario: Impressum is accessible
- **WHEN** a user navigates to `/legal/imprint`
- **THEN** they see a page with the operator's full name, postal address, email address, and the responsible person per §18 Abs. 2 MStV

#### Scenario: Impressum is linked from footer
- **WHEN** a user views any page on the Journal or Planner
- **THEN** the footer contains a link to the Impressum

### Requirement: Terms of Service page
The Journal SHALL serve a Terms of Service page at `/legal/terms` with clear disclaimers about the service's alpha state.

#### Scenario: Alpha status disclosure
- **WHEN** a user reads the Terms page
- **THEN** the Terms clearly state that the service is in early development, untested, and may change without notice

#### Scenario: Database reset disclosure
- **WHEN** a user reads the Terms page
- **THEN** the Terms explicitly state that the operator may delete all user data at any time without prior notice

#### Scenario: Warranty disclaimer
- **WHEN** a user reads the Terms page
- **THEN** the Terms disclaim all warranties to the extent permitted by German consumer law

#### Scenario: Data export responsibility
- **WHEN** a user reads the Terms page
- **THEN** the Terms state that the user is responsible for exporting their own data and link to the data export functionality

### Requirement: Datenschutzerklärung
The Journal SHALL serve a GDPR-compliant privacy policy at `/legal/privacy`, replacing the existing `/privacy` route.

#### Scenario: Controller contact
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** they see the name, address, and email of the data controller (Verantwortlicher per Art. 4 Nr. 7 DSGVO)

#### Scenario: Legal basis for processing
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** each category of data processing lists its legal basis (e.g., Art. 6 Abs. 1 lit. b for contract, lit. f for legitimate interest)

#### Scenario: Data subject rights
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** they see their rights under GDPR: access (Art. 15), rectification (Art. 16), erasure (Art. 17), data portability (Art. 20), objection (Art. 21), and right to lodge a complaint with a supervisory authority

#### Scenario: Redirect from old privacy URL
- **WHEN** a user navigates to `/privacy`
- **THEN** they are redirected to `/legal/privacy` with a 301 status

### Requirement: Alpha banner
The Journal SHALL display a persistent banner notifying users that the service is in alpha, dismissible for the browser session.

#### Scenario: Banner visible on first visit
- **WHEN** a user visits any Journal page for the first time in a session
- **THEN** a banner is shown with text stating trails.cool is in early development and data may be reset, with a link to the Terms

#### Scenario: Banner dismissible
- **WHEN** a user clicks the dismiss button on the alpha banner
- **THEN** the banner is hidden for the remainder of the browser session (via sessionStorage)
- **AND** the banner reappears in a new session

### Requirement: Footer legal links
Both the Journal and Planner SHALL render a footer with links to Impressum, Datenschutzerklärung, and Terms.

#### Scenario: Footer on Journal
- **WHEN** a user views any Journal page
- **THEN** the footer contains links labeled "Impressum", "Privacy", and "Terms" pointing to the respective legal pages

#### Scenario: Footer on Planner
- **WHEN** a user views any Planner page
- **THEN** the footer contains the same three legal links, pointing to the Journal instance (since the Planner is stateless and legal pages live on the Journal)
