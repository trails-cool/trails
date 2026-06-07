# Roadmap

Strategic view of what ships when and why. For implementation detail, see the linked OpenSpec changes in `openspec/changes/`. For exploratory ideas not yet in a change, see `docs/ideas/`.

---

## Launch readiness

Five changes must ship before public announcement:

| Change | Why it blocks launch |
|---|---|
| [`route-sharing`](../openspec/changes/route-sharing/) | Per-user sharing (view/edit), forking, contributor tracking. (Visibility levels already shipped via `public-content-visibility`.) |
| [`social-federation`](../openspec/changes/social-federation/) | The platform is described as federated — launching without it would be misleading. ActivityPub, WebFinger, inbound Mastodon follows. |
| [`visual-redesign`](../openspec/changes/visual-redesign/) | Design system not yet implemented. Current UI is unstyled Tailwind. Must land before any public-facing announcement. |
| [`wahoo-production-cutover`](../openspec/changes/wahoo-production-cutover/) | Wahoo sandbox rate limits make the integration unusable at scale. Ops task, not a feature, but launch-blocking. |
| [`changelog`](../openspec/changes/changelog/) | Public `/changelog` is part of the launch narrative — how we communicate "here's what just shipped" to early users on day one. |

---

## Phases

### Phase 1 — Feature complete

Implement all launch-blocking changes above. There are no dependencies
between them — `social-federation`'s former dependency on `route-sharing`
was satisfied when `public-content-visibility` and `social-feed` shipped
(public routes/activities, public profiles, IRI-keyed follows). All four
can proceed independently:

1. `social-federation` (prerequisites already shipped)
2. `route-sharing`
3. `wahoo-production-cutover` (ops, can run in parallel)
4. `changelog`

### Phase 2 — Polish sprint

After features are stable, run a dedicated UI/UX review pass:

- Walk every user-facing flow end-to-end in a real browser
- Implement `visual-redesign` if not already complete (this change may span phases 1–2)
- Fix rough edges: empty states, loading states, error messages, mobile layout
- Review copy and i18n strings for consistency
- No new features during this phase — polish only

The polish sprint is its own phase because it requires a stable feature set. Polishing during active feature development is expensive churn.

### Phase 3 — Soft launch / beta

Invite 10–20 real users before public announcement:

- Watch Sentry for crashes and unhandled errors
- Watch Grafana for performance regressions
- Watch for federation interop issues (Mastodon follow/unfollow, object delivery)
- Collect structured feedback on onboarding and core flows
- Fix anything critical; defer cosmetic issues to post-launch

### Phase 4 — Public announcement

Announce once beta feedback is resolved:

- Changelog entry for launch
- Social post / blog post

---

## Post-launch

These changes are scoped and designed but not blocking launch:

| Change | Notes |
|---|---|
| [`route-discovery`](../openspec/changes/route-discovery/) | Spatial map-based route exploration. The text `/explore` page covers the gap at launch. |
| [`activity-photos`](../openspec/changes/activity-photos/) | Photo uploads for activities. Enriches content but not a day-one requirement. |
| [`mobile-app`](../openspec/changes/mobile-app/) | React Native unified app. Substantial scope; explicitly post-launch. |
| [`route-federation`](../openspec/changes/route-federation/) | Routes as federated objects: Invite/Accept mirroring, cross-instance Planner edits. The collaboration half of the federation vision; depends on `social-federation` §6 + `route-sharing`. |

---

## Ideas (exploratory, not yet in a change)

See `docs/ideas/` for pre-spec explorations:

- `mobile-activity-recording/` — GPS tracking and activity logging from a native app
- `mobile-nearby-sync/` — BLE-based proximity discovery
- `self-host-overpass/` — Self-hosted Overpass API for POI overlays
- `instance-administration.md` — admin role, registration toggle, suspend/ban, federation blocklists, reports
- `social-interactions.md` — local likes + comments (the foundation the federated kudos/comments attach to)
- `activity-participants.md` — tag co-riders on shared activities, confirm/decline, federated mentions
- `multi-day-collections.md` — activity collections for multi-day trips (architecture open question #1)
