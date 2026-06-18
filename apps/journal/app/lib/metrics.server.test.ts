import { describe, it, expect, beforeEach } from "vitest";
import { normalizeRoute, _resetRouteNormalizationForTest } from "./metrics.server.ts";

describe("normalizeRoute", () => {
  beforeEach(() => {
    _resetRouteNormalizationForTest();
  });

  it("passes static routes through unchanged", () => {
    expect(normalizeRoute("/")).toBe("/");
    expect(normalizeRoute("/feed")).toBe("/feed");
    expect(normalizeRoute("/explore")).toBe("/explore");
    expect(normalizeRoute("/settings/security")).toBe("/settings/security");
    expect(normalizeRoute("/api/v1/routes")).toBe("/api/v1/routes");
    expect(normalizeRoute("/legal/terms")).toBe("/legal/terms");
  });

  it("collapses UUID segments to :id", () => {
    expect(
      normalizeRoute("/activities/0257f241-d880-4ca6-b073-c8706f07a293"),
    ).toBe("/activities/:id");
    expect(
      normalizeRoute("/routes/0257f241-d880-4ca6-b073-c8706f07a293/edit"),
    ).toBe("/routes/:id/edit");
    expect(
      normalizeRoute("/api/v1/activities/0257F241-D880-4CA6-B073-C8706F07A293"),
    ).toBe("/api/v1/activities/:id");
  });

  it("collapses purely-numeric segments to :id", () => {
    expect(normalizeRoute("/api/notifications/12345/read")).toBe(
      "/api/notifications/:id/read",
    );
  });

  it("collapses usernames to :username after a `users` segment", () => {
    expect(normalizeRoute("/users/alice")).toBe("/users/:username");
    expect(normalizeRoute("/users/bob/followers")).toBe(
      "/users/:username/followers",
    );
    expect(normalizeRoute("/api/users/carol/follow")).toBe(
      "/api/users/:username/follow",
    );
  });

  it("collapses sync providers to :provider", () => {
    expect(normalizeRoute("/api/sync/connect/wahoo")).toBe(
      "/api/sync/connect/:provider",
    );
    expect(normalizeRoute("/api/sync/callback/garmin")).toBe(
      "/api/sync/callback/:provider",
    );
    expect(
      normalizeRoute(
        "/api/sync/push/komoot/0257f241-d880-4ca6-b073-c8706f07a293",
      ),
    ).toBe("/api/sync/push/:provider/:id");
  });

  it("strips query strings and fragments before normalizing", () => {
    expect(
      normalizeRoute("/activities/0257f241-d880-4ca6-b073-c8706f07a293?foo=bar"),
    ).toBe("/activities/:id");
    expect(normalizeRoute("/feed#section")).toBe("/feed");
  });

  it("preserves a dotted version segment (does not treat 2.1 as numeric)", () => {
    expect(normalizeRoute("/nodeinfo/2.1")).toBe("/nodeinfo/2.1");
  });

  it("returns the same template for two different ids (bounded cardinality)", () => {
    const a = normalizeRoute("/activities/0257f241-d880-4ca6-b073-c8706f07a293");
    const b = normalizeRoute("/activities/ffffffff-d880-4ca6-b073-c8706f07a293");
    expect(a).toBe(b);
    expect(a).toBe("/activities/:id");
  });

  it("collapses unbounded junk to /other once the cap is exceeded", () => {
    // Fill the tracking set with distinct unmatched paths up to the cap.
    for (let i = 0; i < 200; i++) {
      expect(normalizeRoute(`/scan-${i}`)).toBe(`/scan-${i}`);
    }
    // The next novel path can't be tracked, so it collapses to /other.
    expect(normalizeRoute("/scan-200")).toBe("/other");
    expect(normalizeRoute("/another-novel-path")).toBe("/other");
    // Already-tracked paths are still returned verbatim.
    expect(normalizeRoute("/scan-0")).toBe("/scan-0");
  });
});
