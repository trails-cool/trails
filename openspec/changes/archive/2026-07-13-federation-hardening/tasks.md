## 1. Durable queue

- [x] 1.1 Implement `federation-queue.server.ts`: Fedify `MessageQueue` over pg-boss (enqueue with delay, listen loop), mirroring the `PostgresKvStore` adapter pattern
- [x] 1.2 Swap `InProcessMessageQueue` for it in `federation.server.ts`; document the two-layer queueing (fan-out jobs + Fedify queue) in a code comment
- [x] 1.3 Tests: enqueue/delay/consume roundtrip; simulated restart (new listener picks up previously enqueued messages)

## 2. Replay defense

- [x] 2.1 Add `federation_processed_activities` table (activity IRI PK, received_at) + migration; insert-or-drop check in inbox handlers before side effects
- [x] 2.2 30-day TTL sweep in the jobs worker
- [x] 2.3 Tests: duplicate Like/Delete/Update dropped as no-ops; Create double-delivery still covered by remoteOriginIri constraint

## 3. Blocklist

- [x] 3.1 Add `federation_blocked_instances` table + migration; exact-host check helper
- [x] 3.2 Enforce at inbox (silent 202 drop + counter), delivery enqueue (filter recipients), and outbox poll/actor fetch (refuse)
- [x] 3.3 Document the operator procedure (SQL insert/delete) in the ops docs; tests for all three boundaries

## 4. Protocol doc & observability

- [x] 4.1 Write `FEDERATION.md` (repo root): NodeInfo, actors/WebFinger, object + activity types with JSON examples, addressing, signatures + dedup expectations, retry policy, moderation semantics; link from README and docs
- [x] 4.2 Add `federation_delivery_total{outcome}`, `federation_queue_depth`, `federation_inbox_dropped_total{reason}` metrics + journal dashboard row

## 5. Verification

- [x] 5.1 Staging check (verified on staging.trails.cool 2026-07-13): queued a real delivery, restarted the journal container mid-flight — the job survived the restart in Postgres (the old in-process queue would have lost it) and completed after, "Successfully sent activity … to social.ullrich.is/users/ullrich/inbox" (`federation_delivery_total{outcome="delivered"} 1`, queue drained to 0). Blocklist **outbound** verified: a `poll-remote-actor` for a blocked domain logged `result: {skipped: "blocked instance"}` (no fetch). Operator block/unblock procedure works against the live DB. The blocklist **inbound** drop is covered by the group-2/3 real-Postgres integration tests + the two-instance `e2e/federation/` harness (firing it live needs a peer-initiated signed request).
- [x] 5.2 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` — typecheck/lint/test green locally; `test:e2e` enforced by the required "E2E Tests" CI check on every PR
