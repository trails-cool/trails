## Context

Fedify is configured with `kv: new PostgresKvStore()` but `queue: new InProcessMessageQueue()` (`apps/journal/app/lib/federation.server.ts:146,156`). Fedify uses the queue for outbound delivery (including its retry scheduling) and inbox processing; in-process means a deploy or crash drops everything in flight. Meanwhile `federation-delivery.server.ts` already enqueues *fan-out* jobs via pg-boss (`enqueueOptional`) — so the codebase has two queueing layers, one durable (ours) and one volatile (Fedify's). Inbound: Creates dedup via the `activities.remoteOriginIri` unique constraint; other activity types (Like, Undo, Delete, Update, Accept) have no replay protection. There is no blocklist of any kind (grep-confirmed). wanderer's review (`docs/inspirations.md`) catalogs the same gaps on their side and validates the fix list; their SSRF-safe outbound client and 490-line protocol doc are the positive references.

## Goals / Non-Goals

**Goals:**
- No federation activity is lost to a restart; retries follow the spec's promised backoff/budget durably.
- Replayed or duplicated inbound activities are harmless no-ops.
- An operator can block a hostile instance with one documented action, effective in both directions.
- The protocol surface is documented well enough that another implementation (wanderer, a future project) can interoperate deliberately.

**Non-Goals:**
- Moderation UI, per-actor blocks, allowlist mode, object-level reporting flows.
- Changing the object model, mirror semantics, or delivery topology (`route-federation`'s scope).
- Replacing Fedify.

## Decisions

### 1. Fedify `MessageQueue` implemented over pg-boss

New `federation-queue.server.ts` implementing Fedify's `MessageQueue` interface (`enqueue` with delay support + `listen`) on pg-boss, mirroring how `PostgresKvStore` adapted `KvStore`. Rationale: pg-boss already provides durable storage, delayed jobs, retry bookkeeping, and a worker loop the journal runs — a second bespoke queue table would duplicate it. Fedify's own retry policy stays the policy owner; pg-boss supplies durability. The existing fan-out enqueue in `federation-delivery.server.ts` is unchanged (it feeds Fedify; Fedify's sends become durable underneath).

*Alternative:* Fedify's Redis/Postgres community queue adapters — adds a dependency for less control than ~100 lines over infrastructure we already operate.

### 2. Replay defense: processed-activity table with TTL

`federation_processed_activities` (activity IRI primary key, received_at). Inbox handlers insert-or-skip (`ON CONFLICT DO NOTHING`; conflict → drop as duplicate) before side effects. Rows older than 30 days swept by the jobs worker — replay of month-old activities is already rejected by HTTP-signature date freshness. Creates keep their existing `remoteOriginIri` idempotency as a second layer.

### 3. Blocklist checked at three boundaries, domain-keyed

`federation_blocked_instances(domain, reason, created_at)`. Checks: (a) inbox — activities from actors on blocked domains are dropped before processing (202-and-discard, no error oracle); (b) delivery enqueue — recipients on blocked domains are filtered out; (c) outbox polling / actor fetch — refuses blocked domains. Domain matching is exact-host (subdomain wildcarding deferred until needed). v1 management is a documented SQL statement in the ops runbook; the table is the API an admin UI can later sit on.

### 4. `FEDERATION.md` at repo root

The fediverse-convention filename, documenting: NodeInfo self-identification, actor/WebFinger shape, object types (today's Note-based activities; `trails:Route` once route-federation lands), addressing/audience rules, inbox expectations (signatures, dedup semantics), delivery retry policy (now true), and moderation behavior (what being blocked means). Written from the wanderer-doc model: real JSON examples over prose.

### 5. Observability

pg-boss job outcomes already flow to metrics where instrumented; add `federation_delivery_total{outcome}`, `federation_queue_depth`, `federation_inbox_dropped_total{reason=duplicate|blocked}` and a dashboard row. The queue-depth gauge is the restart-loss regression detector.

## Risks / Trade-offs

- [Two queueing layers (our fan-out jobs + Fedify's queue) remain] → Accepted for now; collapsing them is a refactor with no user-visible payoff. Documented in code comments.
- [Blocklist drops silently (202)] → Deliberate: no error oracle for blocked instances; the drop counter keeps it observable to us.
- [TTL dedup window vs very-late redelivery] → 30 days ≫ signature freshness window; residual risk negligible.
- [pg-boss throughput for delivery spikes] → Fan-out sizes are follower counts on a young network; pg-boss handles far larger job volumes today (sync imports).

## Migration Plan

1. Land queue implementation + swap (behavior-compatible; in-flight in-process queue drains on the old process before cutover deploy).
2. Land dedup + blocklist tables and checks (additive).
3. Publish `FEDERATION.md` + dashboard.
Rollback: revert queue swap (falls back to in-process — the status quo), tables are inert.

## Open Questions

- None blocking. Whether `route-federation` should require blocklist-awareness in mirror sync is noted in that change's update rather than here.
