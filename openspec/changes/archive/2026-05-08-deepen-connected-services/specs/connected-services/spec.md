## MODIFIED Requirements

### Requirement: OAuth token storage in `connected_services`
External-service credentials SHALL be stored in the `journal.connected_services` table (renamed from `sync_connections`) keyed by `(user_id, provider)`. Each row SHALL persist a `credential_kind` discriminator (`oauth | web-login | device`), a `credentials` JSONB blob whose schema is determined by the kind, the provider-side user id (`provider_user_id`, nullable for kinds without one), and OAuth-specific `granted_scopes` as a top-level column (populated only when `credential_kind = 'oauth'`). Disconnecting SHALL delete the row, severing the user's link to the external service without affecting any imported activities.

For `credential_kind = 'oauth'`, the `credentials` blob SHALL contain `access_token`, `refresh_token`, and `expires_at`. Other kinds (web-login, device) carry their own blob shapes and are introduced by their respective consumer changes; the enum value is reserved from day one so adding a kind does not require a migration.

#### Scenario: Wahoo connect persists tokens
- **WHEN** a user completes the Wahoo OAuth flow
- **THEN** a `connected_services` row is upserted with `provider = 'wahoo'`, `credential_kind = 'oauth'`, the `credentials` JSONB containing access/refresh tokens and `expires_at`, the provider user id, and the granted scopes

#### Scenario: Disconnect removes the row but keeps imports
- **WHEN** a user clicks "Disconnect" on a Wahoo connection
- **THEN** the matching `connected_services` row is deleted; previously imported activities are not deleted (they remain owned by the user, just no longer auto-syncing)

#### Scenario: Each user has at most one row per provider
- **WHEN** a user reconnects an already-connected provider
- **THEN** the existing `connected_services` row is updated in place with the fresh credentials; no duplicate row is created

## ADDED Requirements

### Requirement: Capability seams for providers
The system SHALL model each external provider as a manifest declaring its `credential_kind` and which capabilities it implements. Capabilities are modelled as separate interfaces — `Importer`, `RoutePusher`, `WebhookReceiver` — and a provider implements only the subset that applies to it. There SHALL NOT be a unified provider interface that lists every capability with optional methods.

#### Scenario: Add a new provider
- **WHEN** a developer adds a new provider (e.g. Garmin)
- **THEN** they create `providers/<name>/manifest.ts` declaring the provider's `credential_kind` and the capability adapters it implements
- **AND** they implement only the relevant capability interfaces (e.g. an OAuth-pull-only provider implements `Importer` only; not `RoutePusher` or `WebhookReceiver`)
- **AND** they register the manifest by importing it in `providers/registry.ts`
- **AND** existing settings UI, webhook routing, and credential lifecycle work without further changes

### Requirement: Centralized credential lifecycle via `ConnectedServiceManager`
The system SHALL expose a `ConnectedServiceManager` that owns credential lifecycle for all providers. Importers, pushers, and webhook handlers SHALL obtain credentials exclusively via `withFreshCredentials(serviceId, fn)`, which loads the row, refreshes via the kind-appropriate `CredentialAdapter` if expired, calls `fn(credentials)`, and flips `status = needs_relink` if refresh fails. Capability adapters SHALL NOT read the `credentials` JSONB directly.

#### Scenario: Expired OAuth token is refreshed transparently
- **WHEN** a capability adapter calls `withFreshCredentials` for a `connected_services` row whose `expires_at` has passed
- **THEN** the manager invokes the OAuth `CredentialAdapter`'s refresh flow
- **AND** updates the `credentials` JSONB with the new tokens and `expires_at`
- **AND** invokes `fn` with the fresh credentials
- **AND** the capability adapter never sees the expired token

#### Scenario: Refresh failure flips status to needs_relink
- **WHEN** the `CredentialAdapter`'s refresh call returns a permanent failure (e.g. revoked refresh token)
- **THEN** the manager sets `status = 'needs_relink'` on the `connected_services` row
- **AND** raises an error that the caller surfaces as a re-connect prompt
- **AND** subsequent calls for the same service short-circuit until the user re-links
