## Why

Every successful web authentication today inlines the same three-step orchestration in its route handler: record the accepted Terms version on registration (`recordTermsAcceptance`), mint the session cookie (`createSession`), and `redirect(returnTo ?? "/", { headers })`. Four call sites — passkey register-finish, passkey login-finish, magic-link verify-code, and the magic-link click-through consumer — re-implement the same sequence. A bug in any one of them must be fixed in four places, and a future fifth flow (admin impersonation, recovery, etc.) re-derives the same boilerplate.

This change extracts the orchestration into a single function `completeAuth` and folds in the small file-organization win that comes with it (a new `apps/journal/app/lib/auth/` directory). It does **not** introduce an `AuthMethod` interface — see ADR-0005 for why polymorphism here is theoretical with no future adapter.

## What Changes

- **New module** `apps/journal/app/lib/auth/completion.ts` exporting `completeAuth({ userId, isNewRegistration, termsVersion?, request, returnTo? }) → Promise<Response>`. Records terms on registration (only), creates the session, returns a `redirect(...)` Response with the `Set-Cookie` header attached.
- **New module** `apps/journal/app/lib/auth/session.ts` carrying the cookie session storage (`sessionStorage`, `createSession`, `getSessionUser`, `destroySession`) extracted from `auth.server.ts`. The existing path keeps re-exports for backwards compatibility — caller migration is a follow-up if anything.
- **Caller migration**: 4 route handlers (`api.auth.register.ts` passkey-finish branch, `api.auth.login.ts` passkey-finish-passkey branch, `api.auth.login.ts` magic-link verify-code branch, `auth.verify.tsx` magic-link click-through) replace their inlined orchestration with a single `completeAuth(...)` call.
- **`returnTo` sanitization** centralizes inside `completeAuth` (was already same-origin checked in callers; now there's one place).
- **Tests**: new `completion.test.ts` covering register-records-terms, non-register-skips-terms, returnTo default, header attachment, returnTo open-redirect rejection. Existing `e2e/auth.test.ts` continues to pass without modification — that's the proof the refactor is behaviour-preserving.
- **Negative scope (recorded in ADR-0005)**: no `AuthMethod` interface, no adapter pattern. Passkey + magic-link is the entire identity surface; OAuth2/PKCE is session transport, not a third method.

## Capabilities

### New Capabilities

(none — this change reshapes existing capabilities, no new user-visible behaviour.)

### Modified Capabilities

- `authentication-methods`: requirement-level addition codifying that every post-verify web flow goes through the single completion chokepoint that records terms (on register), creates the session, and redirects. User-visible behaviour unchanged.

## Impact

- **Code**: 1 new directory (`apps/journal/app/lib/auth/`), 2 new files (`completion.ts`, `session.ts`), `auth.server.ts` slims down by ~80 lines (the moved session helpers), 4 route handlers shrink. No DB changes. No schema changes.
- **Tests**: 1 new unit test file (`completion.test.ts`). Existing e2e auth test should pass unmodified.
- **Specs**: 1 spec gets a small ADDED requirement (`authentication-methods/spec.md`).
- **Decision references**: `docs/adr/0004-centralize-auth-completion.md`, `docs/adr/0005-no-authmethod-polymorphism.md`, `CONTEXT.md` (Authentication section).
- **Out of scope** (separate concerns): the OAuth-code issuance flow at `/oauth/authorize` (operates on already-authenticated users; only shares the trailing redirect), the magic-link request-token step (emits a token, no session created), the add-passkey post-login ceremony (no session creation). Connected-devices UX is its own spec/change. Session-transport changes (cookie ↔ bearer) are orthogonal and not touched here.
