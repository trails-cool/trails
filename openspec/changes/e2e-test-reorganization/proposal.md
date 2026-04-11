## Why

The planner E2E test file (`e2e/planner.test.ts`) has grown to 42+ tests in a single describe block. Tests that need a computed route manually call `mockBRouter(page)` — this is opt-in and easy to forget, leading to flaky tests when BRouter is slow. Test setup is duplicated across tests (create session, goto URL, wait for connected).

## What Changes

- **Mock BRouter by default**: Use a shared Playwright fixture or `beforeEach` that mocks BRouter for all planner tests. Only integration tests that explicitly test the real BRouter pipeline should use the real endpoint.
- **Split by feature**: Break `planner.test.ts` into focused files: `planner-session.test.ts`, `planner-routing.test.ts`, `planner-multiday.test.ts`, `planner-overlays.test.ts`, `planner-coloring.test.ts`
- **Shared test helpers**: Extract common patterns (create session + goto + wait for connected) into a reusable helper

## Capabilities

### Modified Capabilities
- Testing infrastructure only — no user-facing changes

## Impact

- `e2e/planner.test.ts` → split into 5-6 files
- `e2e/fixtures/brouter-mock.ts` → becomes default fixture
- New `e2e/helpers/planner.ts` for shared setup
- `playwright.config.ts` may need testMatch updates
