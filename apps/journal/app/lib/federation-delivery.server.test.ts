import { describe, it, expect, vi } from "vitest";

// The db/boss imports in the module under test are irrelevant for the
// pure transition helper; stub them so importing the module is cheap.
vi.mock("./db.ts", () => ({ getDb: () => ({}) }));
vi.mock("./boss.server.ts", () => ({ enqueueOptional: vi.fn() }));

const { visibilityTransitionAction } = await import("./federation-delivery.server.ts");

describe("visibilityTransitionAction", () => {
  it("publishes on any transition to public (including re-publish)", () => {
    expect(visibilityTransitionAction("private", "public")).toBe("create");
    expect(visibilityTransitionAction("unlisted", "public")).toBe("create");
    expect(visibilityTransitionAction("public", "public")).toBe("create");
  });

  it("retracts only when leaving public", () => {
    expect(visibilityTransitionAction("public", "private")).toBe("delete");
    expect(visibilityTransitionAction("public", "unlisted")).toBe("delete");
  });

  it("stays silent for non-public to non-public — a Delete would tombstone the URI", () => {
    expect(visibilityTransitionAction("private", "unlisted")).toBeNull();
    expect(visibilityTransitionAction("unlisted", "private")).toBeNull();
    expect(visibilityTransitionAction("private", "private")).toBeNull();
    expect(visibilityTransitionAction("unlisted", "unlisted")).toBeNull();
  });
});
