import { describe, it, expect } from "vitest";
import { normalizeRoute, ROUTE_TEMPLATES } from "./metrics.server.ts";
import routesConfig from "../routes.ts";

describe("normalizeRoute", () => {
  it("passes static routes through unchanged", () => {
    expect(normalizeRoute("/")).toBe("/");
    expect(normalizeRoute("/feed")).toBe("/feed");
    expect(normalizeRoute("/explore")).toBe("/explore");
    expect(normalizeRoute("/settings/security")).toBe("/settings/security");
    expect(normalizeRoute("/api/v1/routes")).toBe("/api/v1/routes");
    expect(normalizeRoute("/legal/terms")).toBe("/legal/terms");
  });

  it("maps dynamic id segments to the :id template", () => {
    expect(
      normalizeRoute("/activities/0257f241-d880-4ca6-b073-c8706f07a293"),
    ).toBe("/activities/:id");
    expect(
      normalizeRoute("/routes/0257f241-d880-4ca6-b073-c8706f07a293/edit"),
    ).toBe("/routes/:id/edit");
    expect(normalizeRoute("/api/notifications/12345/read")).toBe(
      "/api/notifications/:id/read",
    );
  });

  it("maps usernames to the :username template", () => {
    expect(normalizeRoute("/users/alice")).toBe("/users/:username");
    expect(normalizeRoute("/users/bob/followers")).toBe(
      "/users/:username/followers",
    );
    expect(normalizeRoute("/api/users/carol/follow")).toBe(
      "/api/users/:username/follow",
    );
  });

  it("maps sync providers to the :provider template", () => {
    expect(normalizeRoute("/api/sync/connect/wahoo")).toBe(
      "/api/sync/connect/:provider",
    );
    expect(
      normalizeRoute(
        "/api/sync/push/komoot/0257f241-d880-4ca6-b073-c8706f07a293",
      ),
    ).toBe("/api/sync/push/:provider/:routeId");
  });

  it("prefers a literal template over a parametric one", () => {
    // /routes/new must NOT be swallowed by /routes/:id
    expect(normalizeRoute("/routes/new")).toBe("/routes/new");
    expect(normalizeRoute("/activities/new")).toBe("/activities/new");
    // a known provider literal wins over /sync/import/:provider
    expect(normalizeRoute("/sync/import/komoot")).toBe("/sync/import/komoot");
    expect(normalizeRoute("/sync/import/strava")).toBe("/sync/import/:provider");
  });

  it("collapses anything matching no template to /other", () => {
    expect(normalizeRoute("/.ssh/id_rsa")).toBe("/other");
    expect(normalizeRoute("/wp-login.php")).toBe("/other");
    expect(normalizeRoute("/.aws/credentials")).toBe("/other");
    // right prefix, wrong arity also falls through
    expect(normalizeRoute("/routes/abc/def/ghi")).toBe("/other");
    // a username-shaped path under an unknown collection
    expect(normalizeRoute("/profile/alice")).toBe("/other");
  });

  it("strips query strings and fragments and trailing slashes", () => {
    expect(
      normalizeRoute("/activities/0257f241-d880-4ca6-b073-c8706f07a293?foo=1"),
    ).toBe("/activities/:id");
    expect(normalizeRoute("/feed#section")).toBe("/feed");
    expect(normalizeRoute("/feed/")).toBe("/feed");
  });

  it("bounds cardinality: distinct outputs are limited to templates + /other", () => {
    const outputs = new Set<string>();
    for (let i = 0; i < 500; i++) {
      outputs.add(normalizeRoute(`/activities/id-${i}`));
      outputs.add(normalizeRoute(`/scanner-junk-${i}`));
      outputs.add(normalizeRoute(`/users/user${i}`));
    }
    // All 1500 distinct paths collapse to just 3 labels.
    expect([...outputs].sort()).toEqual([
      "/activities/:id",
      "/other",
      "/users/:username",
    ]);
  });
});

describe("ROUTE_TEMPLATES drift guard", () => {
  // Flatten the real route config to full path templates. If a route is
  // added/removed/renamed in app/routes.ts without updating ROUTE_TEMPLATES,
  // this fails — keeping the metric label set honest.
  type Entry = { path?: string; index?: boolean; children?: Entry[] };
  function flatten(entries: Entry[], prefix: string): string[] {
    const out: string[] = [];
    for (const e of entries) {
      if (e.index) {
        out.push(prefix === "" ? "/" : `/${prefix}`);
        continue;
      }
      const full = prefix === "" ? e.path ?? "" : `${prefix}/${e.path ?? ""}`;
      if (e.children && e.children.length > 0) {
        out.push(...flatten(e.children, full));
      } else {
        out.push(`/${full}`);
      }
    }
    return out;
  }

  it("matches every full path declared in app/routes.ts", () => {
    const fromConfig = flatten(routesConfig as unknown as Entry[], "").sort();
    expect(fromConfig).toEqual([...ROUTE_TEMPLATES].sort());
  });
});
