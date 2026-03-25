## 1. No-Go Areas

- [ ] 1.1 Add `noGoAreas` Y.Array to Yjs doc in use-yjs.ts
- [ ] 1.2 Add leaflet-draw (or geoman) dependency for polygon drawing
- [ ] 1.3 Create NoGoAreaLayer component — renders polygons as red overlays, handles draw/delete
- [ ] 1.4 Add no-go area toolbar button to PlannerMap
- [ ] 1.5 Pass no-go areas to BRouter API as `nogo` parameters in brouter.ts
- [ ] 1.6 Trigger route recomputation when no-go areas change

## 2. Session Notes

- [ ] 2.1 Add `notes` Y.Text to Yjs doc in use-yjs.ts
- [ ] 2.2 Create NotesPanel component — textarea bound to Y.Text with real-time sync
- [ ] 2.3 Add "Notes" tab to sidebar (alongside waypoints)
- [ ] 2.4 Add i18n keys for notes UI (en + de)

## 3. Crash Recovery

- [ ] 3.1 Add periodic localStorage save (every 10s) of Yjs state in use-yjs.ts
- [ ] 3.2 On session reconnect, check localStorage for saved state and apply as Yjs update
- [ ] 3.3 Clear localStorage entry after successful sync or session close
- [ ] 3.4 Write unit test for save/restore logic

## 4. Rate Limiting

- [ ] 4.1 Create rate limiter utility in apps/planner/app/lib/rate-limit.ts (already exists — extend for IP tracking)
- [ ] 4.2 Add session creation rate limit (10/IP/hour) in the /new route or API
- [ ] 4.3 Add BRouter proxy rate limit (60/session/hour) in the route computation handler
- [ ] 4.4 Return 429 with Retry-After header and show user-friendly message on client

## 5. Verify

- [ ] 5.1 Test no-go areas: draw polygon, verify route avoids it, delete polygon
- [ ] 5.2 Test notes: type in two windows, verify real-time sync
- [ ] 5.3 Test crash recovery: make changes, kill browser, reopen — verify recovery
- [ ] 5.4 Test rate limiting: exceed limits, verify 429 response
