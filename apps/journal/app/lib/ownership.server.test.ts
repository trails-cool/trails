import { describe, it, expect, vi, beforeEach } from "vitest";

const getRoute = vi.fn();
vi.mock("./routes.server.ts", () => ({
  getRoute: (...args: unknown[]) => getRoute(...args),
}));

const getActivity = vi.fn();
vi.mock("./activities.server.ts", () => ({
  getActivity: (...args: unknown[]) => getActivity(...args),
}));

import {
  loadOwnedRoute,
  loadOwnedActivity,
  requireOwnedRoute,
  requireOwnedActivity,
  vouchOwnership,
} from "./ownership.server.ts";

const USER = "user-1";

describe("loadOwnedRoute / loadOwnedActivity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns not_found for a missing route", async () => {
    getRoute.mockResolvedValue(null);
    expect(await loadOwnedRoute("r1", USER)).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns not_owner for someone else's route", async () => {
    getRoute.mockResolvedValue({ id: "r1", ownerId: "someone-else" });
    expect(await loadOwnedRoute("r1", USER)).toEqual({ ok: false, reason: "not_owner" });
  });

  it("returns the entity when owned", async () => {
    const route = { id: "r1", ownerId: USER, name: "Tour" };
    getRoute.mockResolvedValue(route);
    const result = await loadOwnedRoute("r1", USER);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.entity).toBe(route);
  });

  it("treats remote-ingested activities (ownerId null) as not owned", async () => {
    getActivity.mockResolvedValue({ id: "a1", ownerId: null });
    expect(await loadOwnedActivity("a1", USER)).toEqual({ ok: false, reason: "not_owner" });
  });
});

describe("requireOwnedRoute / requireOwnedActivity", () => {
  beforeEach(() => vi.clearAllMocks());

  async function statusOf(promise: Promise<unknown>): Promise<number> {
    try {
      await promise;
      throw new Error("expected a throw");
    } catch (thrown) {
      // react-router data() throws a Response-like with init status
      return (thrown as { init?: { status: number }; status?: number }).init?.status
        ?? (thrown as { status: number }).status;
    }
  }

  it("throws 404 for missing entities", async () => {
    getRoute.mockResolvedValue(null);
    expect(await statusOf(requireOwnedRoute("r1", USER))).toBe(404);
  });

  it("throws 404 for not-owner by default (no existence leak)", async () => {
    getRoute.mockResolvedValue({ id: "r1", ownerId: "someone-else" });
    expect(await statusOf(requireOwnedRoute("r1", USER))).toBe(404);
  });

  it("throws 403 for not-owner when the surface opts in", async () => {
    getActivity.mockResolvedValue({ id: "a1", ownerId: "someone-else" });
    expect(await statusOf(requireOwnedActivity("a1", USER, { notOwnerStatus: 403 }))).toBe(403);
  });

  it("returns the entity when owned", async () => {
    const activity = { id: "a1", ownerId: USER };
    getActivity.mockResolvedValue(activity);
    expect(await requireOwnedActivity("a1", USER)).toBe(activity);
  });
});

describe("vouchOwnership", () => {
  it("passes the entity through unchanged (brand is type-level)", () => {
    const route = { id: "r1", ownerId: "u9" };
    expect(vouchOwnership(route)).toBe(route);
  });
});
