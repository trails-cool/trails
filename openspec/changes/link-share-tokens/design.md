## Context

Visibility is a three-value column (`private | unlisted | public`, `packages/db/src/schema/journal.ts`); detail loaders enforce owner-only access for `private`. `route-sharing` (proposed, unimplemented) adds per-user view/edit shares for account holders. wanderer's `trail_link_share` (token + permission) and Endurain's hashed API tokens with expiry/last-used are the references. The `activity-privacy-controls` change (proposed) introduces the non-owner mask that link viewers must also pass through.

## Goals / Non-Goals

**Goals:**
- "Send this private route to one person" without publishing it, without them registering, and with the ability to un-send (revoke).
- Zero interaction with listings, feeds, search, or federation — a link is a direct capability, not a visibility state.
- Token hygiene: hashed at rest, high entropy, rate-limited lookup.

**Non-Goals:**
- Edit links (per-user shares + Planner JWT callbacks own editing).
- Passwords on links, download-limited links, OG unfurls for private content.
- Replacing `unlisted` (it remains the "permanent public-ish URL" tier).

## Decisions

### 1. URL shape: token as a query parameter on the canonical URL

`https://<domain>/routes/<id>?share=<token>` (same for activities). The loader resolves access as: owner → full; else valid unrevoked/unexpired token for this resource → non-owner read view; else existing visibility rules. Rationale: one canonical URL per resource (no duplicate `/share/<token>` route tree to keep in sync), and the page can keep the token in subsequent same-page requests (elevation data, thumbnail) by echoing the parameter.

*Alternative:* dedicated `/s/<token>` resolver route — nicer-looking links, but every sub-resource fetch and client navigation needs token plumbing anyway, and two URLs for one resource complicates canonical/OG handling. Rejected for v1.

### 2. Storage and verification

`share_links`: id, `resourceType` (`route|activity`), `resourceId`, `ownerId`, `tokenHash` (SHA-256 of a 128-bit-entropy token, base64url ~22 chars), optional `label`, `expiresAt` nullable, `revokedAt` nullable, `createdAt`, `lastUsedAt`. Plaintext token exists only in the creation response. Lookup = hash the presented token, single indexed query, constant-time compare unnecessary given hashing but cheap to keep. `lastUsedAt` updated at most once per hour per link (avoid hot writes). Deleting the resource cascades.

### 3. Access semantics compose with privacy, never widen it

A valid link yields exactly the **non-owner view**: `activity-privacy-controls` masking applies (if landed), GPX download allowed only where a public non-owner could download it, no edit affordances. The link never surfaces the owner's other content. Robots: link-accessed pages send `noindex`; share links are excluded from sitemaps trivially since resources remain `private`.

### 4. No federation, no listings — structurally

Feed/list/search/outbox queries filter on `visibility`, which is untouched by links; nothing to enforce beyond not adding new query paths. Stated as a spec requirement anyway so future surfaces inherit the rule.

### 5. Management UI on the share dialog

The route/activity share dialog gains a "Share links" section: create (with optional expiry), copy, revoke, per-link label + created/last-used. Multiple links per resource so revoking the one sent to a group chat doesn't kill the one sent to a partner.

## Risks / Trade-offs

- [Links get forwarded beyond the intended person] → Inherent to capability URLs; mitigations are revocation, expiry, last-used visibility, and the privacy mask floor. Same trade `unlisted` already makes, but scoped and revocable.
- [Token in query string lands in server logs] → Our own access logs are the only party (no third-party analytics); Caddy log retention already governed; tokens are revocable. Documented in the privacy manifest.
- [route-sharing overlap confusion] → Positioning is explicit: accounts → per-user shares; no account → link. The share dialog presents both side by side when both exist.

## Migration Plan

Additive table + loader checks + UI; no change to existing access until a link is created. Rollback = revert; existing links stop resolving (fail closed to `private`).

## Open Questions

- None blocking. Whether link viewers should see photos on activities defaults to yes (photos are part of the read view, subject to any future photo-privacy flag).
