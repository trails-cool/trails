import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseKomootUserId,
  verifyKomootOwnership,
  fetchPublicProfile,
  fetchKomootTours,
} from "./komoot.server.ts";

describe("parseKomootUserId", () => {
  it("accepts a plain numeric ID", () => {
    expect(parseKomootUserId("27595800585")).toBe("27595800585");
  });

  it("accepts a full komoot.com URL", () => {
    expect(parseKomootUserId("https://www.komoot.com/user/27595800585")).toBe("27595800585");
  });

  it("accepts a locale-prefixed URL (de-de)", () => {
    expect(parseKomootUserId("https://www.komoot.com/de-de/user/27595800585")).toBe("27595800585");
  });

  it("accepts komoot.de URL", () => {
    expect(parseKomootUserId("https://www.komoot.de/user/12345")).toBe("12345");
  });

  it("returns null for an invalid input", () => {
    expect(parseKomootUserId("not-a-user")).toBeNull();
    expect(parseKomootUserId("https://example.com/user/abc")).toBeNull();
  });
});

describe("fetchPublicProfile", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("maps response fields correctly", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "27595800585",
        display_name: "Test User",
        content: { text: "Visit https://trails.cool/users/ullrich for my routes", link: null },
      }),
    } as Response);

    const profile = await fetchPublicProfile("27595800585");
    expect(profile.displayName).toBe("Test User");
    expect(profile.contentText).toBe("Visit https://trails.cool/users/ullrich for my routes");
    expect(profile.contentLink).toBeNull();
  });

  it("falls back to username when display_name missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ username: "99999", content: {} }),
    } as Response);

    const profile = await fetchPublicProfile("99999");
    expect(profile.displayName).toBe("99999");
  });

  it("throws on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    await expect(fetchPublicProfile("bad")).rejects.toThrow("404");
  });
});

describe("verifyKomootOwnership", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns true when bio contains the trails URL (exact match)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "123",
        content: { text: "https://trails.cool/users/ullrich" },
      }),
    } as Response);
    expect(await verifyKomootOwnership("123", "https://trails.cool/users/ullrich")).toBe(true);
  });

  it("returns true for case-insensitive match", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "123",
        content: { text: "HTTPS://TRAILS.COOL/USERS/ULLRICH" },
      }),
    } as Response);
    expect(await verifyKomootOwnership("123", "https://trails.cool/users/ullrich")).toBe(true);
  });

  it("returns false when bio does not contain the trails URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "123",
        content: { text: "Just a normal bio with no trails link" },
      }),
    } as Response);
    expect(await verifyKomootOwnership("123", "https://trails.cool/users/ullrich")).toBe(false);
  });

  it("returns false when content_text is null", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ username: "123", content: { text: null } }),
    } as Response);
    expect(await verifyKomootOwnership("123", "https://trails.cool/users/ullrich")).toBe(false);
  });

  it("returns false when fetch fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    expect(await verifyKomootOwnership("bad", "https://trails.cool/users/x")).toBe(false);
  });
});

describe("fetchKomootTours", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("appends status=public when no auth token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        _embedded: { tours: [] },
        page: { totalPages: 1, number: 0 },
      }),
    } as Response);
    await fetchKomootTours("123", 1);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("status=public");
  });

  it("omits status=public when auth token provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        _embedded: { tours: [] },
        page: { totalPages: 1, number: 0 },
      }),
    } as Response);
    await fetchKomootTours("123", 1, "sometoken");
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("status=public");
  });

  it("maps tour fields correctly", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        _embedded: {
          tours: [
            {
              id: 987654321,
              name: "Morning ride",
              type: "touringbicycle",
              date: "2024-06-01T08:00:00Z",
              distance: 42000,
              duration: 7200,
              elevation_up: 300,
              elevation_down: 290,
            },
          ],
        },
        page: { totalPages: 3, number: 0 },
      }),
    } as Response);
    const result = await fetchKomootTours("123", 1);
    expect(result.tours).toHaveLength(1);
    expect(result.tours[0]).toMatchObject({
      id: "987654321",
      name: "Morning ride",
      sport: "touringbicycle",
      distance: 42000,
      duration: 7200,
    });
    expect(result.totalPages).toBe(3);
  });
});
