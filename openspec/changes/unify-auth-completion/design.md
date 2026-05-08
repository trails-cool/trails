## Context

`apps/journal/app/lib/auth.server.ts` is 489 lines covering passkey ceremonies, magic-link token lifecycle, session cookie storage, terms recording, and email-change tokens. Four route handlers (`api.auth.register.ts`, `api.auth.login.ts` × 2 branches, `auth.verify.tsx`) each repeat the same trailing sequence after their per-method identity verification:

```ts
if (isNewRegistration) await recordTermsAcceptance(userId, termsVersion);
const headers = await createSession(userId, request);
return redirect(safeReturnTo(returnTo) ?? "/", { headers });
```

The repetition is the *entire* asymmetry between methods at the post-verify layer. WebAuthn vs. magic-link diverge before this point (challenge persistence, token consumption, etc.) but converge here — every flow does the same thing.

ADRs already recorded:
- ADR-0004: centralize this orchestration in a single `completeAuth` function.
- ADR-0005: do **not** extract an `AuthMethod` interface; passkey + magic-link is the entire surface and OAuth2 is transport, not a peer.

## Goals / Non-Goals

**Goals:**
- One function (`completeAuth`) is the only place where a successful web auth records terms + creates session + redirects. Bug fixes apply once.
- File reorganization: `apps/journal/app/lib/auth/` directory containing `completion.ts` and `session.ts`. The existing `auth.server.ts` shrinks but stays for the per-method functions (passkey ceremony, magic-token lifecycle).
- `returnTo` sanitization centralized inside `completeAuth` so no caller can ship an open-redirect.
- Refactor is behaviour-preserving: existing e2e auth tests pass without modification.

**Non-Goals:**
- No `AuthMethod` interface (per ADR-0005).
- The OAuth-code issuance flow at `/oauth/authorize` is NOT migrated. It operates on already-authenticated users; only the trailing redirect overlaps, not enough leverage to fold in.
- The add-passkey post-login ceremony does NOT need `completeAuth` (no session creation — user is already logged in).
- The magic-link request-token step does NOT need `completeAuth` (only emits a token; verification happens later).
- Session transport (cookie vs. bearer) — orthogonal; not touched.
- Connected-devices UX — separate spec.
- Any change to the Terms gate enforcement points (root loader for web, `requireApiUser` for API).

## Decisions

### Decision 1: Single function, no mode flag
`completeAuth` covers exactly the four web post-verify call sites listed in the proposal. There is no `redirectMode: 'cookie' | 'oauth-code'` flag because OAuth-code issuance is genuinely a different flow (already-authenticated user, no session creation, only a code + redirect). Folding both into one function would force a discriminated union and obscure that they don't share much. The OAuth-code path stays in `oauth.authorize.tsx` unchanged.

### Decision 2: Function signature
```ts
async function completeAuth(input: {
  userId: string;
  isNewRegistration: boolean;
  termsVersion?: string;     // required if isNewRegistration; ignored otherwise
  request: Request;
  returnTo?: string | null;
}): Promise<Response>
```

Returns a `Response` (a `redirect` from React Router with the session `Set-Cookie` attached). Callers do `return await completeAuth(...)` from their action / loader. No headers-vs-redirect split: the chokepoint owns both halves.

`termsVersion` is optional at the type level but required-when-`isNewRegistration` at runtime. Asserting it inside the function (throw on `isNewRegistration && !termsVersion`) keeps the call sites tidy. Alternative: a discriminated union forcing the compiler to require `termsVersion` when `isNewRegistration: true`. Lean toward the runtime assertion — three call sites, two of which set `isNewRegistration: false` — the type ergonomics aren't worth the union complexity.

### Decision 3: File layout
New directory `apps/journal/app/lib/auth/` containing:
- `completion.ts` — `completeAuth` + `safeReturnTo` helper (open-redirect rejection).
- `session.ts` — `sessionStorage`, `createSession`, `getSessionUser`, `destroySession`. Moved from `auth.server.ts`.

`auth.server.ts` keeps the per-method functions (passkey ceremony, magic-token lifecycle, terms recording, email-change). It re-exports the moved session helpers from their new home so existing imports keep working without a touch:
```ts
// auth.server.ts
export { sessionStorage, createSession, getSessionUser, destroySession } from "./auth/session.ts";
```

That keeps the migration small. A future change can rip the re-exports and update callers across the app — out of scope here.

### Decision 4: `returnTo` sanitization centralizes inside `completeAuth`
Today, several callers do their own `returnTo` checks of varying rigor (some check `startsWith("/") && !startsWith("//")`, others don't). Move the check into `safeReturnTo` inside `completion.ts`; every caller passes `returnTo` raw and gets the safe version applied uniformly. Reject anything that isn't a same-origin path → fall back to `/`.

### Decision 5: Tests
Unit tests for `completeAuth` in `completion.test.ts`:
- new-registration writes `users.terms_version` + `users.terms_accepted_at` (mock the DB or use an in-memory test DB — match existing test patterns).
- non-registration skips the terms write.
- response includes a `Set-Cookie` header from `sessionStorage.commitSession`.
- `returnTo` of `/foo` redirects to `/foo`; `returnTo` of `//evil.com/x` redirects to `/`; `returnTo` of `https://evil.com` redirects to `/`; missing `returnTo` redirects to `/`.

Existing `e2e/auth.test.ts` (passkey register + login + logout) MUST pass without modification — that's the behaviour-preservation proof.

## Risks / Trade-offs

- **[Risk]** Re-exporting from `auth.server.ts` to maintain backwards compatibility means there are temporarily two paths to the same symbols. → **Mitigation:** comment marks the re-exports as transitional. A follow-up PR (small) can update import paths app-wide and remove the re-exports.

- **[Risk]** The runtime assertion (`isNewRegistration && !termsVersion → throw`) is a programmer error, not a user-visible failure. If a future caller forgets to pass `termsVersion`, tests should catch it; if they don't, registration breaks loudly. → **Accepted:** the type-level alternative (discriminated union) costs more than it pays back at three internal call sites.

- **[Trade-off]** Centralizing `returnTo` sanitization changes behaviour at any call sites that *don't* currently sanitize. The change is strictly safer (rejecting more inputs as `/`) but worth confirming there are no integration tests that pass a deliberately-unsafe `returnTo` and expect it to work.

## Migration Plan

Single PR ("spec apply") containing:

1. Create `apps/journal/app/lib/auth/session.ts` with the moved helpers.
2. Add re-exports in `auth.server.ts`.
3. Create `apps/journal/app/lib/auth/completion.ts` with `completeAuth` + `safeReturnTo`.
4. Write `completion.test.ts` (unit tests).
5. Migrate the 4 callers to `completeAuth`.
6. Verify `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green.

**Rollback**: revert the PR. No DB or schema changes; the file moves are pure code-organization, the call-site changes are mechanical.

## Open Questions

- **Q1**: Does `sessionStorage` get its `secret` from `process.env.SESSION_SECRET` directly, or from a config helper? Move-as-is and revisit only if it complicates the `session.ts` file. → Decide during implementation.
- **Q2**: Should the `auth.server.ts` re-exports be marked `@deprecated` JSDoc-style so editors warn on use? Light touch — yes, with a comment pointing at `./auth/session.ts`. Decide during implementation.
