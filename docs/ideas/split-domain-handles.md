# Split-domain handles for self-hosters

Pre-spec exploration (2026-06-07), prompted by Hollo's split-domain
setup (https://docs.hollo.social/install/split-domain/).

## What it is

Letting the **handle domain** differ from the **server domain**:
`@bob@example.com` while the journal runs at `trails.example.com`.
The apex only has to serve (or redirect) `/.well-known/webfinger`;
actor IRIs, inbox/outbox, and the web UI all live on the server
domain. Mastodon (`WEB_DOMAIN`/`LOCAL_DOMAIN`), GoToSocial
(host/account-domain), and Hollo all support this.

## Why it matters for trails.cool specifically

- Fediverse handles are **permanent identity** — you cannot migrate
  `@bob@trails.example.com` to `@bob@example.com` later. Self-hosters
  who care about their handle want the apex in it from day one.
- Most apexes are taken (a website, an existing service): the operator
  case in this very project — `social.ullrich.is` exists because
  `ullrich.is` was occupied; split-domain would have allowed
  `@ullrich@ullrich.is`.
- A self-hosting-first platform that forces "handle = wherever you can
  host a Node app" is leaving its best identity feature on the table.

## Why it's cheap for us

Architecture Resolved Decision #18 (single domain) was justified as
"avoids WebFinger complexity" — but Fedify natively supports the split:
the `origin` option we already pass to `createFederation` accepts
`{ handleHost, webOrigin }` instead of a string (since Fedify 1.5).
Our side would be roughly:

1. Optional `HANDLE_DOMAIN` env (defaults to `DOMAIN` — Decision #18
   stays the default)
2. Pass `origin: { handleHost: HANDLE_DOMAIN, webOrigin: ORIGIN }`
3. Audit the places that build handles vs URLs (`localActorIri` builds
   URLs — already correct; acct: construction, `users.domain` column
   semantics, profile `@user@domain` rendering)
4. Self-hoster docs: one redirect rule on the apex
   (`/.well-known/webfinger` → server domain), like Hollo's guide

## Interop direction (already a constraint, not an idea)

Regardless of whether WE offer split domains, remote instances use
them — the trails-to-trails check must run against the **actor IRI's
host** after WebFinger resolution, never the handle's domain. Pinned in
`social-federation` task 6.1 and `route-federation`'s gating decision.

## Scope guess

Config + audit + docs + a two-domain test in the (future) two-instance
integration environment. Post-launch self-hosting polish; pairs with
the broader self-host packaging story.
