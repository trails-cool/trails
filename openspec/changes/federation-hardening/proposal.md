## Why

Reviewing wanderer's federation (2026-07-06, `docs/inspirations.md`) showed exactly which operational gaps make an ActivityPub implementation fragile in practice: fire-and-forget delivery, no replay defense, no moderation tooling. trails has one of the same gaps today — the `social-federation` spec promises deliveries "retrying with exponential backoff… after a documented retry budget", but the journal runs Fedify with `InProcessMessageQueue` (`federation.server.ts:156`), so every queued delivery and retry is **lost on container restart** (and restarts are routine: deploys, the OOM/restart-loop history). Before `route-federation` builds mirrors and cross-instance editing on this foundation, delivery must be durable, inbound processing replay-safe, and instances blockable.

## What Changes

- **Durable delivery queue**: replace `InProcessMessageQueue` with a PostgreSQL-backed Fedify `MessageQueue` (built on the existing pg-boss infrastructure), so queued activities and their retry state survive restarts — closing the gap with what the spec already promises.
- **Inbound replay/dedup defense**: processed remote activity IDs are recorded (TTL-bounded) and duplicates are dropped idempotently; complements the existing `remoteOriginIri` unique constraint which only covers ingested Creates.
- **Instance blocklist**: a `federation_blocked_instances` table (domain, reason) enforced at all three boundaries — inbox processing, delivery enqueue, and outbox polling. Managed via documented SQL/ops procedure for v1 (admin UI out of scope).
- **Published protocol documentation**: a root `FEDERATION.md` (the fediverse convention) documenting objects, activities, addressing, retry semantics, NodeInfo identification, and moderation behavior — wanderer's `federation.md` with real JSON examples is the model.
- **Delivery observability**: metrics for delivery success/failure/retry counts and queue depth, on the existing Grafana journal dashboard.
- Not in scope: allowlist-mode federation, admin moderation UI, per-user (as opposed to per-instance) blocks, and object-model changes (that's `route-federation`).

## Capabilities

### New Capabilities
- `federation-operations`: The operational layer of federation — durable delivery, replay defense, instance blocking, protocol documentation, and observability.

### Modified Capabilities
- `social-federation`: the "Push delivery on local activity create" requirement is strengthened to require queue persistence across process restarts.

## Impact

- `apps/journal/app/lib/federation.server.ts` — queue swap; new `federation-queue.server.ts` (Fedify `MessageQueue` over pg-boss) beside the existing `PostgresKvStore`.
- `packages/db` — `federation_blocked_instances` + processed-activity dedup table (TTL sweep via existing jobs worker).
- Inbox/outbound/poll paths — blocklist + dedup checks.
- `FEDERATION.md` (root) + docs link; journal Grafana dashboard panels.
- `route-federation` (in flight) builds on this; noted there as a dependency.
