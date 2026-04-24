import { describe, expect, it } from "vitest";
import { SegmentCache } from "./segment-cache";

describe("SegmentCache", () => {
  it("returns undefined for missing keys", () => {
    const cache = new SegmentCache();
    expect(cache.get("missing")).toBeUndefined();
    expect(cache.has("missing")).toBe(false);
  });

  it("stores and retrieves segments", () => {
    const cache = new SegmentCache();
    const segment = { type: "FeatureCollection" };
    cache.set("k1", segment);
    expect(cache.has("k1")).toBe(true);
    expect(cache.get("k1")).toBe(segment);
    expect(cache.size).toBe(1);
  });

  it("overwrites existing keys without changing size", () => {
    const cache = new SegmentCache();
    cache.set("k1", { v: 1 });
    cache.set("k1", { v: 2 });
    expect(cache.size).toBe(1);
    expect(cache.get("k1")).toEqual({ v: 2 });
  });

  it("evicts the oldest entry when over capacity", () => {
    const cache = new SegmentCache(3);
    cache.set("a", {});
    cache.set("b", {});
    cache.set("c", {});
    cache.set("d", {});
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
    expect(cache.size).toBe(3);
  });

  it("bumps an entry to most-recent on get, delaying its eviction", () => {
    const cache = new SegmentCache(3);
    cache.set("a", {});
    cache.set("b", {});
    cache.set("c", {});
    // Touch "a" so it's most-recent; the next insert should evict "b"
    cache.get("a");
    cache.set("d", {});
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
  });

  it("clear() removes all entries", () => {
    const cache = new SegmentCache();
    cache.set("a", {});
    cache.set("b", {});
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.has("a")).toBe(false);
  });
});
