## ADDED Requirements

### Requirement: Tokenized share links grant read access
Owners SHALL be able to create one or more share links per route or activity. A request carrying a valid (unrevoked, unexpired) link token SHALL receive the resource's read-only non-owner view regardless of `private` visibility, with all non-owner privacy masking applied. Tokens SHALL have at least 128 bits of entropy and be stored hashed; the plaintext SHALL be shown only at creation.

#### Scenario: Private route opened via link
- **WHEN** someone without an account opens a private route's share link
- **THEN** they see the route read-only

#### Scenario: Privacy mask still applies
- **WHEN** an activity with `hideMap` set is opened via share link
- **THEN** the link viewer sees no geometry or GPX download

#### Scenario: Invalid token fails closed
- **WHEN** a request presents a revoked, expired, or unknown token
- **THEN** access falls back to the resource's normal visibility rules

### Requirement: Link management
The share dialog SHALL list a resource's links with label, created and last-used timestamps, support optional expiry at creation, and allow revoking each link individually. Deleting the resource SHALL delete its links.

#### Scenario: Revoke one of several links
- **WHEN** an owner revokes one link while another exists
- **THEN** the revoked link stops resolving and the other continues to work

### Requirement: Links never widen distribution
Link-shared resources SHALL NOT appear in feeds, listings, search, sitemaps, or federation as a consequence of link creation, and link-accessed pages SHALL be marked non-indexable.

#### Scenario: Linked private route stays out of listings
- **WHEN** a private route has active share links
- **THEN** it appears in no feed, listing, search result, or ActivityPub object

### Requirement: Token lookup rate limiting
Share-link resolution SHALL be rate-limited per IP to blunt token scanning, without affecting normally-visible content.

#### Scenario: Scanning throttled
- **WHEN** an IP rapidly probes many invalid tokens
- **THEN** further lookups from that IP are rejected with 429 for a cooldown period
