import { describe, it, expect } from "vitest";
import {
  API_VERSION,
  ENDPOINTS,
  // Errors
  ApiErrorResponseSchema,
  ERROR_CODES,
  // Pagination
  PaginationQuerySchema,
  // Discovery
  DiscoveryResponseSchema,
  // Auth
  TokenExchangeRequestSchema,
  TokenResponseSchema,
  DeviceSchema,
  // Routes
  RouteSummarySchema,
  RouteListResponseSchema,
  CreateRouteRequestSchema,
  UpdateRouteRequestSchema,
  ComputeRouteRequestSchema,
  // Activities
  CreateActivityRequestSchema,
  // Uploads
  PresignedUploadRequestSchema,
} from "./index.ts";

describe("API_VERSION", () => {
  it("is a valid semver string", () => {
    expect(API_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("ENDPOINTS", () => {
  it("has correct static paths", () => {
    expect(ENDPOINTS.discovery).toBe("/.well-known/trails-cool");
    expect(ENDPOINTS.routes.list).toBe("/api/v1/routes");
    expect(ENDPOINTS.activities.list).toBe("/api/v1/activities");
    expect(ENDPOINTS.auth.token).toBe("/api/v1/auth/token");
    expect(ENDPOINTS.uploads.presign).toBe("/api/v1/uploads");
  });

  it("has correct dynamic paths", () => {
    expect(ENDPOINTS.routes.detail("abc-123")).toBe("/api/v1/routes/abc-123");
    expect(ENDPOINTS.activities.delete("xyz")).toBe("/api/v1/activities/xyz");
    expect(ENDPOINTS.auth.device("dev-1")).toBe("/api/v1/auth/devices/dev-1");
  });
});

describe("ApiErrorResponseSchema", () => {
  it("accepts valid error", () => {
    const result = ApiErrorResponseSchema.parse({
      error: "Not found",
      code: "NOT_FOUND",
    });
    expect(result.code).toBe("NOT_FOUND");
  });

  it("accepts error with field errors", () => {
    const result = ApiErrorResponseSchema.parse({
      error: "Validation failed",
      code: ERROR_CODES.VALIDATION_ERROR,
      fields: [{ field: "name", message: "Required" }],
    });
    expect(result.fields).toHaveLength(1);
  });

  it("rejects missing error field", () => {
    expect(() => ApiErrorResponseSchema.parse({ code: "X" })).toThrow();
  });
});

describe("PaginationQuerySchema", () => {
  it("defaults limit to 20", () => {
    const result = PaginationQuerySchema.parse({});
    expect(result.limit).toBe(20);
    expect(result.cursor).toBeUndefined();
  });

  it("coerces string limit", () => {
    const result = PaginationQuerySchema.parse({ limit: "50" });
    expect(result.limit).toBe(50);
  });

  it("rejects limit > 100", () => {
    expect(() => PaginationQuerySchema.parse({ limit: 101 })).toThrow();
  });
});

describe("DiscoveryResponseSchema", () => {
  it("accepts valid discovery", () => {
    const result = DiscoveryResponseSchema.parse({
      apiVersion: "1.0.0",
      instanceName: "trails.cool",
      apiBaseUrl: "https://trails.cool/api/v1",
    });
    expect(result.apiVersion).toBe("1.0.0");
  });

  it("accepts optional tileUrl", () => {
    const result = DiscoveryResponseSchema.parse({
      apiVersion: "1.0.0",
      instanceName: "my-instance",
      apiBaseUrl: "https://example.com/api/v1",
      tileUrl: "https://tiles.example.com/{z}/{x}/{y}.pbf",
    });
    expect(result.tileUrl).toBeDefined();
  });
});

describe("TokenExchangeRequestSchema", () => {
  it("accepts authorization_code grant", () => {
    const result = TokenExchangeRequestSchema.parse({
      grant_type: "authorization_code",
      code: "abc123",
      code_verifier: "verifier",
      client_id: "trails-cool-mobile",
      redirect_uri: "trailscool://auth/callback",
    });
    expect(result.grant_type).toBe("authorization_code");
  });

  it("accepts refresh_token grant", () => {
    const result = TokenExchangeRequestSchema.parse({
      grant_type: "refresh_token",
      refresh_token: "refresh-abc",
      client_id: "trails-cool-mobile",
    });
    expect(result.grant_type).toBe("refresh_token");
  });

  it("rejects invalid grant_type", () => {
    expect(() => TokenExchangeRequestSchema.parse({
      grant_type: "password",
      client_id: "x",
    })).toThrow();
  });
});

describe("TokenResponseSchema", () => {
  it("accepts valid token response", () => {
    const result = TokenResponseSchema.parse({
      access_token: "at-123",
      refresh_token: "rt-456",
      token_type: "Bearer",
      expires_in: 3600,
    });
    expect(result.token_type).toBe("Bearer");
  });
});

describe("CreateRouteRequestSchema", () => {
  it("accepts minimal route", () => {
    const result = CreateRouteRequestSchema.parse({ name: "My Route" });
    expect(result.name).toBe("My Route");
    expect(result.description).toBe("");
  });

  it("accepts route with GPX", () => {
    const result = CreateRouteRequestSchema.parse({
      name: "Berlin Tour",
      description: "A nice ride",
      gpx: "<gpx>...</gpx>",
      routingProfile: "fastbike",
    });
    expect(result.gpx).toBeDefined();
  });

  it("rejects empty name", () => {
    expect(() => CreateRouteRequestSchema.parse({ name: "" })).toThrow();
  });

  it("rejects name over 200 chars", () => {
    expect(() => CreateRouteRequestSchema.parse({ name: "x".repeat(201) })).toThrow();
  });
});

describe("UpdateRouteRequestSchema", () => {
  it("accepts partial update", () => {
    const result = UpdateRouteRequestSchema.parse({ name: "New Name" });
    expect(result.name).toBe("New Name");
    expect(result.gpx).toBeUndefined();
  });

  it("accepts GPX-only update", () => {
    const result = UpdateRouteRequestSchema.parse({ gpx: "<gpx>...</gpx>" });
    expect(result.gpx).toBeDefined();
  });
});

describe("ComputeRouteRequestSchema", () => {
  it("accepts valid waypoints", () => {
    const result = ComputeRouteRequestSchema.parse({
      waypoints: [
        { lat: 52.52, lon: 13.405 },
        { lat: 52.51, lon: 13.39 },
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

describe("RouteSummarySchema", () => {
  const validRoute = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Berlin Tour",
    description: "",
    distance: 42000,
    elevationGain: 340,
    elevationLoss: 320,
    routingProfile: "fastbike",
    dayBreaks: [2],
    geojson: null,
    createdAt: "2026-04-12T10:00:00.000Z",
    updatedAt: "2026-04-12T12:00:00.000Z",
  };

  it("accepts valid route summary", () => {
    const result = RouteSummarySchema.parse(validRoute);
    expect(result.name).toBe("Berlin Tour");
  });

  it("accepts nullable fields as null", () => {
    const result = RouteSummarySchema.parse({
      ...validRoute,
      distance: null,
      elevationGain: null,
      elevationLoss: null,
      routingProfile: null,
    });
    expect(result.distance).toBeNull();
  });
});

describe("RouteListResponseSchema", () => {
  it("accepts paginated response", () => {
    const result = RouteListResponseSchema.parse({
      routes: [],
      nextCursor: "abc123",
    });
    expect(result.nextCursor).toBe("abc123");
  });

  it("accepts null nextCursor (last page)", () => {
    const result = RouteListResponseSchema.parse({
      routes: [],
      nextCursor: null,
    });
    expect(result.nextCursor).toBeNull();
  });
});

describe("CreateActivityRequestSchema", () => {
  it("accepts minimal activity", () => {
    const result = CreateActivityRequestSchema.parse({ name: "Morning Ride" });
    expect(result.name).toBe("Morning Ride");
  });

  it("accepts activity with all fields", () => {
    const result = CreateActivityRequestSchema.parse({
      name: "Morning Ride",
      description: "Nice weather",
      gpx: "<gpx>...</gpx>",
      routeId: "550e8400-e29b-41d4-a716-446655440000",
      startedAt: "2026-04-12T07:00:00.000Z",
      duration: 3600,
      distance: 25000,
    });
    expect(result.routeId).toBeDefined();
  });
});

describe("PresignedUploadRequestSchema", () => {
  it("accepts valid upload request", () => {
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
      resourceId: "550e8400-e29b-41d4-a716-446655440000",
    })).toThrow();
  });
});

describe("DeviceSchema", () => {
  it("accepts valid device", () => {
    const result = DeviceSchema.parse({
      id: "dev-1",
      deviceName: "iPhone 16e",
      lastActiveAt: "2026-04-12T10:00:00.000Z",
      createdAt: "2026-04-10T08:00:00.000Z",
      isCurrent: true,
    });
    expect(result.deviceName).toBe("iPhone 16e");
  });
});
