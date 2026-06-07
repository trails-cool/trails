## 0. Preconditions

- [ ] 0.1 `social-federation` §6 (outbound trails-to-trails follows + NodeInfo instance check) shipped
- [ ] 0.2 `route-sharing` shipped (local share model the Invite extends)
- [ ] 0.3 Two-instance integration environment exists (social-federation task 11.4's docker-compose setup — shared prerequisite)

## 1. Vocabulary + object surface

- [ ] 1.1 Define the trails JSON-LD context document (versioned, served at a stable URL); `trails:Route` type with metadata envelope fields
- [ ] 1.2 Fedify object dispatcher for routes at the canonical route URL (public-only; owner-private ⇒ 404), content-negotiation middleware on the route detail page (same pattern as activities)
- [ ] 1.3 GPX `Document` attachment on the object; verify shapes against a second live instance before merging (soak lesson: arrays, dereferenceability, tombstones)

## 2. Create/Update fan-out

- [ ] 2.1 Publish-on-public + version-created hooks enqueue route activity deliveries (reuse deliver-activity job patterns; transition-aware retraction rules apply to routes too)
- [ ] 2.2 Inbox listeners accept `Update(trails:Route)` from verified trails instances holding a mirror relationship; reject otherwise

## 3. Invite/Accept collaboration

- [ ] 3.1 Schema: route collaborators support remote actor IRIs (exactly-one-of local/remote pattern); mirror provenance on routes (`remote_origin_iri` et al.)
- [ ] 3.2 Share dialog accepts remote trails handles; outbound `Invite` delivery with Pending state
- [ ] 3.3 Inbox: `Accept(Invite)` registers the collaborator + sends current route; `Reject(Invite)`/`Undo` lifecycle
- [ ] 3.4 Mirror storage + rendering (read-only route page attributed to origin, "mirrored from" affordance, stale badge)

## 4. Cross-instance edit tokens

- [ ] 4.1 Token issuance endpoint (HTTP-Signature verified, collaborator-checked, single-use jti, rate-limited, audited)
- [ ] 4.2 Edit-in-planner flow from a mirror: request token from origin, open Planner with origin callback
- [ ] 4.3 Callback path records remote contributors by actor IRI; contributor display via remote_actors cache

## 5. Sync healing

- [ ] 5.1 pg-boss cron: verify mirrors against canonical objects, re-fetch on version gap, mark unreachable origins

## 6. Hardening + rollout

- [ ] 6.1 Feature flag (own flag or FEDERATION_ENABLED tier), staged soak with a second instance, security review of the token endpoint
- [ ] 6.2 Privacy manifest: what collaborator instances learn/store
- [ ] 6.3 Two-instance integration tests: invite→accept→mirror, update fan-out, cross-instance edit roundtrip, sync healing after simulated downtime
