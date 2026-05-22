## Approach

Split `e2e/planner.test.ts` (581 lines, 42+ tests) into 5 feature-focused files. Extract a shared helper for the common create-session + navigate + wait-connected pattern. Make BRouter mocked by default in files where routing is needed via `test.beforeEach`.

## File Map

### New files

| File | Tests | BRouter |
|------|-------|---------|
| `e2e/planner-session.test.ts` | Home page, session creation, basic session UI, GPX import | No mock needed |
| `e2e/planner-routing.test.ts` | Route splitting, zoom to fit, waypoint notes, POI snap | `beforeEach` mock |
| `e2e/planner-multiday.test.ts` | Overnight toggle, multi-day GPX export | `beforeEach` mock |
| `e2e/planner-overlays.test.ts` | Hillshading tiles, POI category markers | No mock needed |
| `e2e/planner-coloring.test.ts` | Color mode, road type chart, hover label | `beforeEach` mock |

### New helper

`e2e/helpers/planner.ts` — exports:
- `createSession(request)` → `string` (session URL)
- `openSession(page, url)` → `Promise<void>` (goto + waitForConnected)

### Unchanged

`e2e/fixtures/brouter-mock.ts` — stays as-is; each file that needs it calls `mockBRouter(page)` in `beforeEach`.

### Deleted

`e2e/planner.test.ts`

## BRouter Default Mock

Files whose tests always need a computed route add:

```ts
test.beforeEach(async ({ page }) => {
  await mockBRouter(page);
});
```

This is explicit and discoverable. Tests in `planner-session.test.ts` and `planner-overlays.test.ts` never need routing, so they don't mock BRouter at all.
