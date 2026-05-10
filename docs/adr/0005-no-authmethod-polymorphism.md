# No `AuthMethod` polymorphism — passkey + magic-link is the entire surface

A natural temptation when reshaping auth is to extract an
`AuthMethod` interface (analogous to the connected-services
`Importer` / `RoutePusher` / `WebhookReceiver` capability seams) so
passkey and magic-link become two adapters of a common shape, with
future Google/Apple/SAML/etc. as additional adapters. We are
explicitly **not** doing that, and recording the negative decision
here so future architecture passes don't re-suggest it.

Two reasons. First, the *number of adapters is fixed*: passkey is
trails.cool's preferred identity method and magic-link is its
fallback for browsers without WebAuthn support and cross-device sign-
in. There are no plans for additional methods. Social sign-in (Google,
Apple) would conflict with the privacy-first ethos in `CLAUDE.md`
(third-party identity providers see every login), would fight the
ActivityPub federation model (centralized OIDC vs.
`user@domain` identity), and would add account-linking edge cases
without a UX win — passkeys already deliver the one-tap convenience
that justifies social sign-in elsewhere. With two adapters and no
forecast third, an `AuthMethod` interface is theoretical
polymorphism with no future second customer; the deletion test fails.

Second, the *interface shape would be shallow*. WebAuthn is a
multi-step ceremony (start → finish, with challenge persistence
between calls); magic-link is a request-then-verify flow with a
15-minute token in the database. Forcing both into a unified
`startAuth(input) → finishAuth(response)` interface produces an
adapter where each implementation barely shares a type signature —
the two flows have genuinely different shapes, and the seam would
fill with optional methods and discriminated unions. The real
repetition lives in the *post-verify orchestration* (record terms,
mint session, redirect), which ADR-0004 addresses with a single
`completeAuth` function — no polymorphism required.

OAuth2/PKCE in the `mobile-app` change is sometimes mistaken for a
third auth method. It isn't: mobile users still authenticate via
passkey or magic-link in a WebView, and OAuth2 only exchanges the
resulting code for long-lived bearer tokens. OAuth2 is **session
transport** (peer of: HTTP-only cookie), not identity proof.
