# Two-instance federation harness

Spec: `openspec/changes/social-federation/` task 11.4.

Two complete journal instances — `journal-a.test` and `journal-b.test` —
federate with each other inside a Docker network, with real HTTPS
between them (a Caddy with `local_certs` terminates TLS; the journals
trust its internal CA via `NODE_EXTRA_CA_CERTS`). The driver test seeds
a user on each side, follows across instances through the real UI
route, and asserts the full pipeline:

```
alice@journal-a  ──Follow──▶  bob@journal-b   (NodeInfo + WebFinger +
                ◀──Accept──                    actor fetch over TLS)
                ──signed outbox poll──▶
alice's /feed shows bob's public activity with @bob@journal-b.test
```

## Run it

```bash
./e2e/federation/run.sh              # build, test, tear down
KEEP_STACK=1 ./e2e/federation/run.sh # leave the stack up afterwards
```

First run builds the journal image (a few minutes); later runs reuse it.
Opt-in only — nothing here runs under `pnpm test`, `pnpm test:e2e`, or
CI. The driver lives at
`apps/journal/app/lib/federation-two-instance.integration.test.ts`
(gated by `FEDERATION_TWO_INSTANCE=1`).

## How the driver authenticates

Sessions are signed cookies (`auth/session.server.ts`). The harness
journals run with a known `SESSION_SECRET`, so the driver mints a valid
`__session` cookie for the seeded user instead of driving the WebAuthn
ceremony. That secret (and everything else in the compose env) is a
throwaway test value on a loopback-only stack.

## Why `FEDERATION_ALLOW_PRIVATE_ADDRESS`

Fedify's document loader refuses private network addresses (SSRF
guard). Both instances here live on RFC 1918 Docker addresses, so the
harness sets `FEDERATION_ALLOW_PRIVATE_ADDRESS=true` — the env-gated
opt-out in `federation.server.ts`. Never set it in a real deployment.

## Debugging

```bash
docker compose -f e2e/federation/docker-compose.yml logs -f journal-a
docker compose -f e2e/federation/docker-compose.yml exec postgres \
  psql -U trails trails_a -c 'TABLE journal.follows'
```

`FEDERATION_LOG_LEVEL=debug` is already on — Fedify logs every
signature verification and delivery attempt.
