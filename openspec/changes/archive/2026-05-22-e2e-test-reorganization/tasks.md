## 1. Shared helper

- [x] 1.1 Create `e2e/helpers/planner.ts` with `createSession(request)` and `openSession(page, url)` helpers

## 2. Split test files

- [x] 2.1 Create `e2e/planner-session.test.ts` — home page, session creation, basic session UI, GPX import (14 tests)
- [x] 2.2 Create `e2e/planner-routing.test.ts` — route splitting, zoom to fit, waypoint notes, POI snap (4 tests, BRouter mocked in beforeEach)
- [x] 2.3 Create `e2e/planner-multiday.test.ts` — overnight toggle, multi-day GPX export (2 tests, BRouter mocked in beforeEach)
- [x] 2.4 Create `e2e/planner-overlays.test.ts` — hillshading tiles, POI category markers (2 tests)
- [x] 2.5 Create `e2e/planner-coloring.test.ts` — color mode, road type chart, hover label (3 tests, BRouter mocked in beforeEach)

## 3. Clean up

- [x] 3.1 Delete `e2e/planner.test.ts`
