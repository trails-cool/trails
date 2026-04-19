## Purpose

Legal pages, signup acknowledgement, and alpha-state disclosures required for operating trails.cool under German law (TMG, MStV, GDPR).

## Requirements

### Requirement: Impressum page
The Journal SHALL serve an Impressum page at `/legal/imprint` containing the operator's legal information per §5 TMG and §18 MStV, an EU online-dispute-resolution notice, and an English translation.

#### Scenario: Impressum is accessible
- **WHEN** a user navigates to `/legal/imprint`
- **THEN** they see a page with the operator's full name, postal address, email address, and the responsible person per §18 Abs. 2 MStV

#### Scenario: Impressum is linked from footer
- **WHEN** a user views any page on the Journal or Planner
- **THEN** the footer contains a link to the Impressum

#### Scenario: EU ODR notice
- **WHEN** a user reads the Impressum
- **THEN** they see a link to the EU online-dispute-resolution platform (ec.europa.eu/consumers/odr) and a statement that the operator is not willing or obliged to participate in consumer arbitration proceedings

#### Scenario: English translation
- **WHEN** a user reads the Impressum
- **THEN** an English version of each section is rendered below its German counterpart and the page notes that the German version is authoritative

### Requirement: Terms of Service page
The Journal SHALL serve a Terms of Service page at `/legal/terms` with disclosures about alpha state, service availability, minimum age, content usage rights, and acceptable use.

#### Scenario: Alpha status disclosure
- **WHEN** a user reads the Terms page
- **THEN** the Terms clearly state that the service is in early development, currently free of charge, and may change without notice

#### Scenario: Service availability
- **WHEN** a user reads the Terms page
- **THEN** the Terms state that the operator may modify, limit, interrupt, or discontinue the service or individual accounts at any time

#### Scenario: Database reset disclosure
- **WHEN** a user reads the Terms page
- **THEN** the Terms explicitly state that the operator may delete all user data at any time without prior notice

#### Scenario: Warranty and liability
- **WHEN** a user reads the Terms page
- **THEN** the Terms disclaim warranties and tier liability consistent with German law (unlimited for intent / gross negligence / life-body-health; limited-to-foreseeable for cardinal-duty breach under slight negligence; otherwise excluded)

#### Scenario: Data export responsibility
- **WHEN** a user reads the Terms page
- **THEN** the Terms state that the user is responsible for exporting their own data and reference the GPX / JSON export functionality

#### Scenario: Minimum age for accounts
- **WHEN** a user reads the Terms page
- **THEN** the Terms state that Journal accounts require a minimum age of 16, while anonymous Planner use has no age requirement

#### Scenario: Content usage rights
- **WHEN** a user reads the Terms page
- **THEN** the Terms state that users retain ownership of their content and grant the operator only a limited, non-transferable licence to store, process, and display that content for the purpose of operating the service

#### Scenario: Acceptable use
- **WHEN** a user reads the Terms page
- **THEN** the Terms prohibit illegal content, abusive use (spam, flooding, DoS), circumvention of technical protections, and mass automated data extraction

#### Scenario: English translation
- **WHEN** a user reads the Terms page
- **THEN** each German section has a short English summary, and the page notes that the German version is authoritative

### Requirement: Datenschutzerklärung
The Journal SHALL serve a GDPR-compliant privacy policy at `/legal/privacy`, replacing the existing `/privacy` route. It SHALL follow classical GDPR structure with a developer-friendly Privacy Manifest appended at the end.

#### Scenario: Controller contact
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** they see the name, address, and email of the data controller (Verantwortlicher per Art. 4 Nr. 7 DSGVO)

#### Scenario: Data categories and purposes
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** they see an explicit enumeration of the data categories processed (account data, user content, auth artefacts, Planner session state, server logs, Sentry error data) together with the purpose of each

#### Scenario: Legal basis for processing
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** each category of data processing lists its legal basis (Art. 6 Abs. 1 lit. b for accounts / login / stored content / transactional email; lit. f for server logs, rate-limiting, error monitoring)

#### Scenario: Terms acceptance is not consent
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** acceptance of the Terms of Service is classified under Art. 6 Abs. 1 lit. b (contract) and NOT under lit. a (consent), and the policy states this explicitly

#### Scenario: Server logs disclosure
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** a dedicated section describes that HTTP requests are logged (IP address, timestamp, method, path, status code, user-agent), the purpose (security / operations / debugging), the legal basis (Art. 6 Abs. 1 lit. f), and a retention period of at most 14 days

#### Scenario: Storage durations
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** a list of storage durations is shown covering at minimum: account and user content (until deletion by the user), Planner sessions (≤7 days), magic-link tokens (≤15 minutes), server logs (≤14 days), Sentry events (≤90 days)

#### Scenario: Alpha reset caveat
- **WHEN** a user reads the storage-durations section
- **THEN** the section notes that during alpha the operator may reset the database or delete individual records, which can cause data loss before a user requests deletion, and points to the Terms of Service

#### Scenario: Third-party disclosures
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** each third party receives its own entry describing what is transmitted and why, covering at minimum: Sentry (error tracking; sendDefaultPii disabled; no session replays), OpenStreetMap tile servers (browser transmits IP and user-agent directly to OSM), Overpass (queries proxied through the Planner server so upstream only sees our server IP), BRouter (self-hosted, no third party involved), and the SMTP service used for transactional email

#### Scenario: Third-country transfer note for Sentry
- **WHEN** a user reads the Sentry disclosure
- **THEN** the policy notes that Sentry is a US-based provider and that transfers into a third country within the meaning of Art. 44 ff. DSGVO may occur, with the legal mechanism (Standard Contractual Clauses) named

#### Scenario: Data subject rights
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** they see their rights under GDPR: access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction (Art. 18), data portability (Art. 20), objection (Art. 21), and the right to lodge a complaint with a supervisory authority

#### Scenario: Complaint authority
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** they see the address and website of the Berlin data-protection commissioner as the competent supervisory authority

#### Scenario: Privacy Manifest appendix
- **WHEN** a user reads the Datenschutzerklärung
- **THEN** a developer-friendly Privacy Manifest follows the formal sections, summarising Planner (no cookies / no localStorage / no sessionStorage / no browser-side Sentry), Journal (what is stored, exportable), Sentry scope by login state, and security practices

#### Scenario: Redirect from old privacy URL
- **WHEN** a user navigates to `/privacy`
- **THEN** they are redirected to `/legal/privacy` with a 301 status

### Requirement: Alpha banner
The Journal SHALL display a persistent, non-dismissable banner on every page notifying users that the service is in alpha and that their data may be reset.

#### Scenario: Banner always visible
- **WHEN** a user views any Journal page at any time during the alpha phase
- **THEN** the alpha banner is rendered with text stating trails.cool is in early development and data may be reset
- **AND** there is no dismiss control; the banner does not use cookies, localStorage, or sessionStorage

### Requirement: Footer legal links
Both the Journal and Planner SHALL render a footer with links to Impressum, Datenschutzerklärung, Terms of Service, and the source repository.

#### Scenario: Footer on Journal
- **WHEN** a user views any Journal page
- **THEN** the footer contains links labeled "Impressum", "Privacy", and "Terms" pointing to the respective `/legal/*` pages, plus a link to the source repository

#### Scenario: Footer on Planner
- **WHEN** a user views any Planner page
- **THEN** the footer contains the same legal links, pointing at absolute URLs on the Journal instance (since the Planner is stateless and legal pages live on the Journal), plus a link to the source repository
