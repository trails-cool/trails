## Why

The demo-activity-bot is hardcoded to "Bruno the Berlin dog walker" — a persona that reads well for `trails.cool` itself but makes no sense for a self-hosted instance in Tokyo, Denver, or Edinburgh. If we want federated hosts to turn the demo on, each instance needs to choose its own demo identity, region, and copy so visitors see a plausible local-voice feed rather than a stranger's Berlin park patrol.

## What Changes

- Make the demo user's identity (username, display name, bio) configurable per instance via env — today `ensureDemoUser()` inserts `bruno` with a fixed display name and bio.
- Allow each instance to supply its own generated-content pools (route-name pool and description pool) in EN + DE — today these are hardcoded string arrays in `demo-bot.server.ts`.
- Allow each instance to restrict the demo to its preferred locale(s) — today the bot picks EN or DE with a coin flip.
- Keep all configuration in a single `DEMO_BOT_PERSONA` JSON blob (env or file path) so operators can supply one artifact instead of threading five env vars.
- Retain the current built-in Bruno persona as the default when no override is supplied, so `trails.cool` itself keeps its current behavior with no operator action.
- Keep `DEMO_BOT_ENABLED`, `DEMO_BOT_REGION`, and `DEMO_BOT_RETENTION_DAYS` as they are today (region is a separate concern from persona; retention + enable-flag are orthogonal).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `demo-activity-bot`: the bot's identity and generated copy become a **persona contract** supplied by the operator rather than a fixed Bruno/Berlin combination. The generation gate, retention, cap, and synthetic flag are unchanged.

## Impact

- **Code:** `apps/journal/app/lib/demo-bot.server.ts` — replace the four hardcoded `*_POOL_*` arrays and the three `DEMO_*` constants with a loaded-once `DemoPersona` object. `ensureDemoUser()` consumes the persona's `username`/`displayName`/`bio`. `templateName`/`templateDescription` read from the persona's pools.
- **UX:** `/users/<username>` — the 🐕 demo badge needs to gate on a runtime-known username, not a literal `"bruno"`. Move the gate to loader data (`isDemoUser` boolean) rather than a client-side string check.
- **Ops:** `infrastructure/.env.example`, `docker-compose.yml` — add `DEMO_BOT_PERSONA` passthrough; document the JSON shape. Existing `DEMO_BOT_REGION` et al. stay.
- **Docs:** a short persona-authoring note in `docs/` (one page) so host operators know the JSON shape + sensible pool sizes.
- **Tests:** new unit tests for `loadPersona()` (env → persona, fallback to built-in Bruno, malformed JSON → fallback + warn). Existing integration + E2E tests continue to work unchanged because the default persona is still Bruno.
- **No breaking change for `trails.cool`:** the built-in Bruno persona remains the default and is exactly the current hardcoded strings.
