## 1. New auth module structure

- [ ] 1.1 Create `apps/journal/app/lib/auth/` directory.
- [ ] 1.2 Create `apps/journal/app/lib/auth/session.ts` and move `sessionStorage`, `createSession`, `getSessionUser`, `destroySession` from `auth.server.ts` (preserve behaviour, including `process.env.SESSION_SECRET` source).
- [ ] 1.3 In `auth.server.ts`, re-export the moved helpers from `./auth/session.ts` so existing imports keep working unchanged. Add a JSDoc `@deprecated`-style comment pointing at the new path.

## 2. completeAuth chokepoint

- [ ] 2.1 Write `apps/journal/app/lib/auth/completion.test.ts` (TDD red): scenarios for new-registration writes terms, non-registration skips terms, returnTo defaults to `/`, returnTo `//evil.com` rejected, returnTo `https://evil.com` rejected, response includes Set-Cookie.
- [ ] 2.2 Create `apps/journal/app/lib/auth/completion.ts` exporting `completeAuth({ userId, isNewRegistration, termsVersion?, request, returnTo? }) → Promise<Response>` and a private `safeReturnTo(value)` helper. Implementation: assert `termsVersion` when `isNewRegistration`; if `isNewRegistration`, `recordTermsAcceptance(userId, termsVersion)`; `createSession(userId, request)`; `redirect(safeReturnTo(returnTo) ?? "/", { headers })`.
- [ ] 2.3 Run completion tests green.

## 3. Caller migration

- [ ] 3.1 `apps/journal/app/routes/api.auth.register.ts` passkey-finish branch — replace inlined session+redirect with `return completeAuth({ userId, isNewRegistration: true, termsVersion, request, returnTo })`. Drop now-unused imports.
- [ ] 3.2 `apps/journal/app/routes/api.auth.login.ts` passkey `step: "finish-passkey"` branch — replace with `return completeAuth({ userId, isNewRegistration: false, request, returnTo })`.
- [ ] 3.3 `apps/journal/app/routes/api.auth.login.ts` magic-link `step: "verify-code"` branch — replace with `return completeAuth(...)`.
- [ ] 3.4 `apps/journal/app/routes/auth.verify.tsx` magic-link click-through consumer — replace with `return completeAuth(...)`.
- [ ] 3.5 Confirm no other callers of `createSession` remain inside auth route handlers (they should all flow through `completeAuth`). `getSessionUser` and `destroySession` continue to be called directly from non-completion sites — that's expected.

## 4. Verification

- [ ] 4.1 `pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] 4.2 `pnpm test:e2e` (auth flows) green without modification — proves behaviour-preserving refactor.
- [ ] 4.3 Manual sanity: register with passkey locally, login with passkey, log out, re-login via magic-link 6-digit code, click-through magic link from `auth.verify.tsx`. Confirm session cookie set + correct redirect each time.

## 5. Documentation + follow-up

- [ ] 5.1 At archive time, apply the spec delta in `specs/authentication-methods/` to `openspec/specs/`.
- [ ] 5.2 (Optional follow-up — not part of this change) update import paths app-wide from `auth.server.ts` to `./auth/session.ts` and drop the re-exports. Track separately.
