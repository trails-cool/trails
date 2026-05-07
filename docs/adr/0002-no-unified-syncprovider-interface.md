# No unified SyncProvider interface; capabilities are separate seams

The `connected-services` spec calls for a "provider-agnostic framework," and
the obvious shape is a single `SyncProvider` interface with `connect /
refresh / importOne / pushRoute / handleWebhook`. We rejected this because
the providers we actually need to support are heterogeneous: Komoot is
import-only via web-login (no refresh, no webhooks, no push), Apple Health
is mobile-pushed (no server-initiated anything, no remote credential),
Wahoo has all four. A unified interface would be OAuth-shaped by default
and adapters would fill it with NOPs — shallow at the seam, leaky at the
adapters.

Instead, capabilities are separate seams: `Importer`, `RoutePusher`,
`WebhookReceiver`. Each provider declares which capabilities it implements
in a co-located manifest (`providers/<name>/manifest.ts`); a small
`registry.ts` imports each manifest. Credential lifecycle is the one thing
shared across providers, and lives in `ConnectedServiceManager` +
`CredentialAdapter` (per kind). If we ever genuinely need pan-provider
behaviour, we add it to the manager — not to a provider interface.
