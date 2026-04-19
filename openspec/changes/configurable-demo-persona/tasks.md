## 1. Persona type + schema

- [x] 1.1 Define `DemoPersona` TypeScript interface in `apps/journal/app/lib/demo-bot.server.ts` with `username`, `displayName`, `bio`, `locales: ("en"|"de")[]`, `content: { names: { en?: string[]; de?: string[] }, descriptions: { en?: string[]; de?: string[] } }`
- [x] 1.2 Add a Zod schema mirroring the interface: username `^[a-z0-9][a-z0-9_-]{1,30}$`, displayName 1–200 chars, bio 0–200 chars, locales a non-empty subset of `["en","de"]`, each content array 3–50 non-empty strings, ensure every listed locale has both `names` and `descriptions` populated
- [x] 1.3 Move the current hardcoded Bruno strings into a `DEFAULT_PERSONA: DemoPersona` export — confirm it round-trips through the Zod schema before export

## 2. Loader

- [x] 2.1 Add `loadPersona(): DemoPersona` that reads `DEMO_BOT_PERSONA`: if unset → `DEFAULT_PERSONA`; if it starts with `file:` → read the rest as an absolute path via `fs.readFileSync`; otherwise treat as inline JSON
- [x] 2.2 Parse with the Zod schema; on validation failure or file-read failure, log a warn with the first error message and return `DEFAULT_PERSONA`
- [x] 2.3 Cache the result in a module-level `Object.freeze`d constant so every caller sees the same instance
- [x] 2.4 Remove the now-unused `DEMO_USERNAME`, `DEMO_DISPLAY_NAME`, `DEMO_BIO`, `NAME_POOL_EN`, `NAME_POOL_DE`, `DESCRIPTION_POOL_EN`, `DESCRIPTION_POOL_DE` constants — every reference must flow through the persona

## 3. Wire into bootstrap + generation

- [x] 3.1 `ensureDemoUser()` takes the loaded persona and writes `username`, `displayName`, `bio`, and sentinel email `${persona.username}@<domain>`
- [x] 3.2 Before insert, `SELECT` the row matching the username; if it exists and was not inserted by a prior demo-bot boot (heuristic: email does not match the sentinel pattern), throw `DemoPersonaUsernameClashError`; server startup catches this and declines to schedule the demo jobs for the process
- [x] 3.3 `templateName(startedAt, locale)` reads from `persona.content.names[locale]` with the existing seeded indexing; same for `templateDescription`
- [x] 3.4 Locale selection in `generateOneWalk` picks randomly from `persona.locales` via `pickLocale()` (dropping the hardcoded 50/50 EN/DE coin flip)

## 4. UX — demo badge via loader flag

- [x] 4.1 In `users.$username.tsx` loader, compute `isDemoUser` by comparing `user.username` against `loadPersona().username`; include `isDemoUser` in the loader return
- [x] 4.2 Replace the client-side `user.username === "bruno"` check with the loader-supplied boolean
- [x] 4.3 Keep the `demo.badge` i18n key exactly as-is so existing translations continue to work

## 5. Env + docs

- [x] 5.1 Add `DEMO_BOT_PERSONA` passthrough in `infrastructure/docker-compose.yml` (journal service)
- [x] 5.2 Add a commented `DEMO_BOT_PERSONA` example to `infrastructure/.env.example` with the inline JSON form AND the `file:/path/to/persona.json` form
- [x] 5.3 Write `docs/demo-persona.md` — a one-page guide covering: schema shape, inline vs `file:` modes, required pool sizes, how the built-in default looks, and an example persona for a non-Berlin instance

## 6. Tests

- [x] 6.1 Unit: `loadPersona()` — unset env returns default; valid inline JSON parses to the persona; invalid JSON falls back + warns; valid JSON that violates the Zod schema falls back + warns
- [x] 6.2 Unit: `loadPersona()` with `file:` — reads a real file via a temp path; unreadable file falls back + warns
- [x] 6.3 Unit: `templateName`/`templateDescription` draw from the supplied persona's pool and never return entries outside it
- [x] 6.4 Integration (`DEMO_BOT_INTEGRATION=1`): `ensureDemoUser` with the default persona is idempotent; clash with a pre-existing real user throws `DemoPersonaUsernameClashError`
- [x] 6.5 E2E: no regression — `/users/bruno` still shows the 🐕 badge for the built-in Bruno persona (re-ran `e2e/demo-bot.test.ts` unchanged, both pass)

## 7. Rollout

- [x] 7.1 Merge + deploy — nothing changes because default persona equals current behaviour
- [ ] 7.2 Validate on prod: `/users/bruno` unchanged, synthetic content cadence unchanged, metrics unchanged
- [ ] 7.3 (Optional demo) On a staging or second instance, ship a non-Bruno persona via `DEMO_BOT_PERSONA=file:...` and confirm the demo user renders with the new identity + voice
