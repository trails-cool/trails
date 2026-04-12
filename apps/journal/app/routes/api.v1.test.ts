import { describe, it, expect } from "vitest";
import {
  PaginationQuerySchema,
  CreateRouteRequestSchema,
  UpdateRouteRequestSchema,
  CreateActivityRequestSchema,
  ComputeRouteRequestSchema,
  PresignedUploadRequestSchema,
  ERROR_CODES,
} from "@trails-cool/api";

describe("Zod validation for API endpoints", () => {
  describe("PaginationQuerySchema", () => {
    it("defaults limit to 20", () => {
      const result = PaginationQuerySchema.parse({});
      expect(result.limit).toBe(20);
      expect(result.cursor).toBeUndefined();
    });

    it("accepts valid cursor and limit", () => {
      const result = PaginationQuerySchema.parse({ cursor: "abc", limit: "50" });
      expect(result.cursor).toBe("abc");
      expect(result.limit).toBe(50);
    });

    it("rejects limit > 100", () => {
      expect(() => PaginationQuerySchema.parse({ limit: 101 })).toThrow();
    });
  });

  describe("CreateRouteRequestSchema", () => {
    it("accepts minimal route", () => {
      const result = CreateRouteRequestSchema.parse({ name: "Test" });
      expect(result.name).toBe("Test");
      expect(result.description).toBe("");
    });

    it("rejects empty name", () => {
      expect(() => CreateRouteRequestSchema.parse({ name: "" })).toThrow();
    });

    it("accepts route with GPX", () => {
      const result = CreateRouteRequestSchema.parse({
        name: "Tour",
        gpx: "<gpx>...</gpx>",
        routingProfile: "fastbike",
      });
      expect(result.gpx).toBeDefined();
    });
  });

  describe("UpdateRouteRequestSchema", () => {
    it("accepts partial update", () => {
      const result = UpdateRouteRequestSchema.parse({ name: "New Name" });
      expect(result.name).toBe("New Name");
    });

    it("accepts GPX-only update", () => {
      const result = UpdateRouteRequestSchema.parse({ gpx: "<gpx/>" });
      expect(result.gpx).toBe("<gpx/>");
    });
  });

  describe("CreateActivityRequestSchema", () => {
    it("accepts minimal activity", () => {
      const result = CreateActivityRequestSchema.parse({ name: "Ride" });
      expect(result.name).toBe("Ride");
    });

    it("accepts full activity", () => {
      const result = CreateActivityRequestSchema.parse({
        name: "Morning Ride",
        gpx: "<gpx/>",
        routeId: "550e8400-e29b-41d4-a716-446655440000",
        startedAt: "2026-04-12T07:00:00.000Z",
        duration: 3600,
        distance: 25000,
      });
      expect(result.duration).toBe(3600);
    });
  });

  describe("ComputeRouteRequestSchema", () => {
    it("accepts valid waypoints", () => {
      const result = ComputeRouteRequestSchema.parse({
        waypoints: [
          { lat: 52.52, lon: 13.405 },
          { lat: 48.137, lon: 11.576 },
        ],
      });
      expect(result.waypoints).toHaveLength(2);
      expect(result.profile).toBe("fastbike");
    });

    it("rejects fewer than 2 waypoints", () => {
      expect(() => ComputeRouteRequestSchema.parse({
        waypoints: [{ lat: 52.52, lon: 13.405 }],
      })).toThrow();
    });
  });

  describe("PresignedUploadRequestSchema", () => {
    it("accepts valid upload", () => {
      const result = PresignedUploadRequestSchema.parse({
        filename: "photo.jpg",
        contentType: "image/jpeg",
        resourceType: "route",
        resourceId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.resourceType).toBe("route");
    });

    it("rejects invalid resource type", () => {
      expect(() => PresignedUploadRequestSchema.parse({
        filename: "x.jpg",
        contentType: "image/jpeg",
        resourceType: "user",
        resourceId: "abc",
      })).toThrow();
    });
  });
});

describe("ERROR_CODES", () => {
  it("has all expected codes", () => {
    expect(ERROR_CODES.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(ERROR_CODES.NOT_FOUND).toBe("NOT_FOUND");
    expect(ERROR_CODES.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(ERROR_CODES.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
  });
});

describe("cursor pagination logic", () => {
  const items = [
    { id: "a" }, { id: "b" }, { id: "c" },
    { id: "d" }, { id: "e" }, { id: "f" },
  ];

  function paginate(cursor: string | undefined, limit: number) {
    let startIdx = 0;
    if (cursor) {
      const idx = items.findIndex((r) => r.id === cursor);
      startIdx = idx >= 0 ? idx + 1 : 0;
    }
    const page = items.slice(startIdx, startIdx + limit);
    const nextCursor = startIdx + limit < items.length
      ? page[page.length - 1]?.id ?? null
      : null;
    return { page, nextCursor };
  }

  it("returns first page without cursor", () => {
    const { page, nextCursor } = paginate(undefined, 3);
    expect(page.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(nextCursor).toBe("c");
  });

  it("returns next page with cursor", () => {
    const { page, nextCursor } = paginate("c", 3);
    expect(page.map((p) => p.id)).toEqual(["d", "e", "f"]);
    expect(nextCursor).toBeNull();
  });

  it("returns null cursor on last page", () => {
    const { nextCursor } = paginate("d", 10);
    expect(nextCursor).toBeNull();
  });

  it("resets to start for unknown cursor", () => {
    const { page } = paginate("unknown", 2);
    expect(page.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
