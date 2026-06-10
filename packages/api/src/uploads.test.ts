import { describe, it, expect } from "vitest";
import {
  PresignedUploadRequestSchema,
  sanitizeUploadFilename,
} from "./uploads.ts";

const ROUTE_ID = "11111111-1111-4111-8111-111111111111";

describe("PresignedUploadRequestSchema", () => {
  it("accepts an allowed content type", () => {
    const r = PresignedUploadRequestSchema.safeParse({
      filename: "photo.jpg",
      contentType: "image/jpeg",
      resourceType: "activity",
      resourceId: ROUTE_ID,
    });
    expect(r.success).toBe(true);
  });

  it("rejects active/disallowed content types", () => {
    for (const contentType of ["text/html", "image/svg+xml", "application/javascript"]) {
      const r = PresignedUploadRequestSchema.safeParse({
        filename: "x", contentType, resourceType: "route", resourceId: ROUTE_ID,
      });
      expect(r.success, contentType).toBe(false);
    }
  });

  it("rejects a non-uuid resourceId and empty filename", () => {
    expect(PresignedUploadRequestSchema.safeParse({
      filename: "a.png", contentType: "image/png", resourceType: "route", resourceId: "nope",
    }).success).toBe(false);
    expect(PresignedUploadRequestSchema.safeParse({
      filename: "", contentType: "image/png", resourceType: "route", resourceId: ROUTE_ID,
    }).success).toBe(false);
  });
});

describe("sanitizeUploadFilename", () => {
  it("strips path components (no traversal into the key)", () => {
    expect(sanitizeUploadFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeUploadFilename("/abs/path/img.png")).toBe("img.png");
    expect(sanitizeUploadFilename("a\\b\\c.jpg")).toBe("c.jpg");
  });

  it("restricts to a conservative charset and collapses runs", () => {
    expect(sanitizeUploadFilename("my photo (1)!.jpg")).toBe("my_photo_1_.jpg");
  });

  it("strips leading dots so dotfiles / .. can't form the segment", () => {
    expect(sanitizeUploadFilename("...hidden")).toBe("hidden");
    expect(sanitizeUploadFilename("..")).toBe("upload");
  });

  it("never returns empty", () => {
    expect(sanitizeUploadFilename("")).toBe("upload");
    expect(sanitizeUploadFilename("////")).toBe("upload");
  });

  it("bounds the length", () => {
    expect(sanitizeUploadFilename("a".repeat(500)).length).toBeLessThanOrEqual(128);
  });
});
