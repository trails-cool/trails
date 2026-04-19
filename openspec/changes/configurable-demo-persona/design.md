## Context

The just-merged `demo-activity-bot` spec gave `trails.cool` a synthetic public user — Bruno, a Berlin dog on walkabout. The implementation works but hardcodes everything a host operator would sensibly want to customise: `username = "bruno"`, a fixed display name + bio, two string pools of English/German walk-name copy, and an inner-Berlin bbox as the default region.

Self-hosted instances are the core of this project's federation story. We don't want every federated instance running a Berlin-themed dog walker; that ranges from confusing (why does the Tokyo instance have a Berlin-named bot?) to actively off-brand (the persona voice is playful — not every community wants playful). If turning on `DEMO_BOT_ENABLED=true` ships an identity that isn't theirs, most operators just won't turn it on.

The bot itself (decide-to-walk gate, cap, BRouter client, retention, synthetic column, metrics) is generic and has no reason to change. Only the *persona* — the identity + voice — needs to become operator-supplied.

Region is already configurable via `DEMO_BOT_REGION`. That stays as-is; this proposal does not merge region into the persona blob because regions and personas are orthogonal (an operator may want to run the default Bruno persona but in a different bbox for testing).

## Goals / Non-Goals

**Goals:**

- A single env var — `DEMO_BOT_PERSONA` — that accepts either an inline JSON blob or a `file:` URL pointing at a mounted JSON file, so operators can ship either via SOPS env or via a config volume.
- Built-in default remains exactly the current Bruno persona, so `trails.cool` needs no operator action when this ships.
- Persona supplies: `username`, `displayName`, `bio`, `locales: ("en" | "de")[]`, and `content: { names: { en?: string[]; de?: string[] }, descriptions: { en?: string[]; de?: string[] } }`.
- `/users/<username>` continues to render the 🐕 demo badge, but the gate moves from the hardcoded string `"bruno"` to a loader-supplied `isDemoUser` boolean derived from the persona.
- Malformed JSON, missing required fields, or an unreachable `file:` path fall back to the built-in Bruno persona and emit a single warn-level log line at worker boot. The worker never crashes over a bad persona file.

**Non-Goals:**

- Runtime reload. The persona is read once at worker boot. Operators restart the journal container to pick up a new persona. Live reload adds complexity for no user value (operators change personas monthly at most).
- Per-request persona selection. There is exactly one demo user per instance.
- Allowing the persona to be edited in the web UI by an admin. That would be a separate `admin-persona-editor` change; out of scope here.
- Supporting arbitrary locales beyond EN + DE. The app only has those two locale bundles today, and adding locales is a cross-cutting change tracked elsewhere.
- Moving region into the persona blob. Region and persona are orthogonal; two env vars remain two env vars.

## Decisions

### D1. One JSON blob via env, with `file:` fallback for multi-line content.

Go with a single `DEMO_BOT_PERSONA` env var. Accept two shapes:

1. Inline JSON — `DEMO_BOT_PERSONA='{"username":"bruno",...}'`. Fine for short personas.
2. `file:`-prefixed path — `DEMO_BOT_PERSONA=file:/etc/trails-cool/persona.json`. For realistic personas the pools are ~10–15 entries each; inlining 50 strings of JSON into a SOPS env file is miserable.

*Alternatives considered:*
- **Separate env vars for each field** (`DEMO_BOT_USERNAME`, `DEMO_BOT_DISPLAY_NAME`, `DEMO_BOT_NAME_POOL_EN`, …). Rejected: 10+ related env vars, and list-valued vars need an ad-hoc separator that invites quoting bugs.
- **TOML or YAML file**. Rejected: the rest of the repo uses JSON env blobs (`DEMO_BOT_REGION` is already JSON). Stay consistent.
- **`DEMO_BOT_PERSONA_FILE` as a separate env var**. Rejected: two env vars for one concept. The `file:` prefix is a well-known convention (12-factor app config).

### D2. Zod schema for validation.

Parse with a Zod schema that enforces: username matches `^[a-z0-9][a-z0-9_-]{1,30}$` (same constraint as registration), `displayName` and `bio` are non-empty strings up to 200 chars, `locales` is a non-empty subset of `["en", "de"]`, each `content.names.<locale>` and `content.descriptions.<locale>` is an array of 3–50 non-empty strings.

Reason for the 3–50 bound: fewer than 3 makes repeats painfully obvious in the daily feed; more than 50 eats unneeded memory and suggests the operator should move to a content pipeline instead of hand-editing JSON.

*Alternatives considered:*
- **No validation — trust the operator.** Rejected: malformed persona is a silent footgun. A bad regex in `username` is a violation of the DB constraint and would crash `ensureDemoUser()` on boot.
- **Hand-rolled runtime type checks.** Rejected: the repo already uses Zod in `@trails-cool/api` for request validation. Reuse the pattern.

### D3. Persona loading happens once, at worker boot, cached for process lifetime.

Add `loadPersona()` that returns a `DemoPersona` object. It's called from `demo-bot.server.ts` module init (not from each job handler) and the result is frozen. `ensureDemoUser()` and the job handlers all read from this module-level constant.

Side effect: if an operator changes the persona JSON and the worker is already running, the change doesn't take effect until the container restarts. This is the intended behaviour (see non-goals) and is the same pattern as `DEMO_BOT_REGION` + `DEMO_BOT_RETENTION_DAYS` today.

### D4. Built-in default persona lives in code, not a default JSON file.

The existing Bruno strings become a `DEFAULT_PERSONA: DemoPersona` export in `demo-bot.server.ts`. When no `DEMO_BOT_PERSONA` is set, or validation fails, `loadPersona()` returns the default. This keeps the happy path (no operator config) identical to what just shipped.

*Alternatives considered:*
- **Bundle a `personas/bruno.json` in the image and set `DEMO_BOT_PERSONA=file:...` by default.** Rejected: more moving parts for no benefit. Everyone who reads the code already sees the strings; shipping them as a JSON asset doesn't improve readability and adds a runtime read on every boot.

### D5. The 🐕 demo badge becomes a loader-supplied flag.

Today `users.$username.tsx` checks `user.username === "bruno"` client-side. That was fine when Bruno was a literal. Now the check must know which username the running instance chose as its demo user. Two options:

- **Ship the persona username to the client** so the comparison stays client-side.
- **Have the loader compute `isDemoUser` and pass a boolean to the component.**

Choose the loader path. The persona username is not otherwise needed in the client, and shipping instance config through HTML reads as a small information leak even if it's technically public. `isDemoUser` is crisp.

### D6. No migration. No backwards-compatibility shim. No deprecation window.

This change is additive: new env var, default preserves current behaviour. There is nothing to migrate. The hardcoded string constants (`DEMO_USERNAME`, `DEMO_DISPLAY_NAME`, `DEMO_BIO`, `NAME_POOL_*`, `DESCRIPTION_POOL_*`) are removed and folded into `DEFAULT_PERSONA`. Importers of `DEMO_USERNAME` (there are none) would break — but the grep is clean.

## Risks / Trade-offs

**[Risk] Operator supplies a persona that conflicts with an existing real user's username on first enable.**
→ `ensureDemoUser()`'s insert currently ON CONFLICT DO NOTHING on `username` would silently pick up the existing real user as the demo user's owner — all subsequent synthetic rows would attach to that real user. Fix: before insert, SELECT the username; if it exists AND the row is not already marked demo, log an error and disable the bot for this process. Track via a new `demo-bot persona username clash` log line; the operator sees a loud error on boot.

**[Risk] Operator supplies a persona with empty content pools.**
→ The Zod schema rejects arrays shorter than 3. Worker falls back to the default persona and logs the rejection reason.

**[Risk] A `file:`-referenced JSON file is unreadable at boot (permissions, wrong mount).**
→ `loadPersona()` catches the read error and falls back to the default persona with a warn log. The bot stays functional on the built-in Bruno.

**[Risk] The demo badge is skipped on a legitimately-chosen username that happens to clash with a real user.**
→ Not a real issue in practice: the badge reads `isDemoUser` from the loader, which is derived by `userId === personaUserId`, not by username comparison. Two users can never share an ID.

**[Trade-off] One JSON blob vs. typed env vars.**
→ JSON is harder to lint in SOPS/CI than `KEY=value` pairs. Mitigated by the `file:` mode for nontrivial personas, and by the Zod validation surfacing the parse error at worker boot.

## Migration Plan

This is a no-op for `trails.cool` itself:

1. Merge + deploy. Nothing changes — the built-in Bruno persona is the default, produced by the exact same strings the bot generates today.
2. For a self-hosted instance that wants its own persona: write `persona.json`, mount it or inline it via SOPS, set `DEMO_BOT_PERSONA=file:/path/to/persona.json`, set `DEMO_BOT_ENABLED=true`, and restart the journal container.

Rollback is trivial: unset `DEMO_BOT_PERSONA` and restart. The default persona returns.

## Open Questions

- Should the persona schema include an emoji / glyph override so a cat-themed instance can replace the 🐕 in the badge? Leaning yes but the glyph is i18n'd today (lives in the `demo.badge` key), which complicates things. Defer — ship without it, revisit if a real host asks.
- Should we expose a `/api/demo-persona` endpoint for federation peers to fetch the current persona? No real need today; a federating peer doesn't need to know that a remote user is synthetic, only that their content is public. Park.
