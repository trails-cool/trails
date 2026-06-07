# Instance administration & moderation

Pre-spec exploration. Envisioned in `docs/architecture.md` (§Instance
Administration) since day one, never spec'd. Now that federation is live
on staging — a public inbox accepting traffic from arbitrary instances —
the moderation half has moved from "eventually" to "before the federated
surface grows."

## Scope sketch

**Instance settings**
- Instance name, description, rules page (rendered at `/about`)
- Open/close registration (env var today at best; should be a runtime
  admin setting)
- Instance-level contact / operator info (some of this exists for the
  legal pages — consolidate)

**User management**
- Admin role (first user? env-designated? explicit grant)
- Suspend / unsuspend users (suspended: no login, content hidden,
  federation stops — actor 404s like a private profile)
- Delete user + content (GDPR path; account-management spec covers
  self-deletion, not admin-initiated)

**Federation management**
- Per-instance blocklist: refuse inbox traffic, drop follows, stop
  deliveries to blocked domains (checked in the inbox rate-limit layer
  we already have — `federationSourceHost` is the natural hook)
- Per-instance silence (content hidden from shared surfaces but
  follows still work) — maybe later; block first
- Visibility into federation peers: which instances follow us /
  we deliver to, volumes, error rates (remote_actors table + Fedify
  logs already hold most of this)

**Reports & moderation queue**
- Report content/users (local reports first; ActivityPub `Flag`
  federation later)
- Simple queue: open → resolved/dismissed, with action taken

## Constraints & notes

- Mastodon's admin model is the obvious reference; ours can be a tiny
  subset (single-admin instances are the norm for self-hosters).
- The federated-comments idea (`fediverse-enhancements.md`) explicitly
  depends on at least instance blocks + report handling existing.
- Suspension must compose with federation the same way profile privacy
  does today: suspended ⇒ actor 404, push delivery suppressed (the
  `social-federation` spec's 9.3 mechanics generalize).
- Admin surfaces are user-facing strings → i18n from the start (en+de).
