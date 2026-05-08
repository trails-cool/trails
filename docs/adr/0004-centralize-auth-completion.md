# Centralize web auth completion in `completeAuth`

Every successful web authentication today (passkey login, passkey
register, magic-link code verify, magic-link click-through verify)
inlines the same three-step orchestration in its route handler:
record the accepted Terms version on registration, mint the session
cookie, and redirect to `returnTo` (or `/`). With four call sites
re-implementing the same sequence, a bug in any of them — a missed
terms write, a wrong cookie option, an open-redirect-prone returnTo
— must be fixed in four places, and a future fifth flow (e.g. an
admin-impersonation login, a one-time recovery flow) re-derives the
same boilerplate.

We extract the orchestration into a single function
`completeAuth({ userId, isNewRegistration, termsVersion?, request,
returnTo? })` at `apps/journal/app/lib/auth/completion.ts`. Per-method
identity verification (WebAuthn ceremony, magic-token consumption)
stays in its own function and runs *before* `completeAuth` —
the chokepoint deliberately knows nothing about how identity was
proved. Terms enforcement (the gate) remains middleware (root loader
for web, `requireApiUser` for API); `completeAuth` only *records*
terms on registration. The OAuth-code-issuance flow at
`/oauth/authorize` is **not** routed through `completeAuth` — it
operates on an already-authenticated user and shares only the
trailing redirect, not the full sequence (see ADR-0005 for the
broader scope decision).
