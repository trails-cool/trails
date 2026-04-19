import { describe, it, expect } from "vitest";
import { canView, type Viewable, type Viewer } from "./auth.server.ts";

const owner: Viewer = { id: "owner-id" };
const other: Viewer = { id: "other-id" };

function row(visibility: "private" | "unlisted" | "public"): Viewable {
  return { ownerId: owner.id, visibility };
}

describe("canView", () => {
  describe("public content", () => {
    it("is viewable by the owner", () => {
      expect(canView(row("public"), owner)).toBe(true);
    });
    it("is viewable by another logged-in user", () => {
      expect(canView(row("public"), other)).toBe(true);
    });
    it("is viewable by a logged-out visitor", () => {
      expect(canView(row("public"), null)).toBe(true);
    });
    it("ignores asDirectLink (always viewable)", () => {
      expect(canView(row("public"), null, { asDirectLink: false })).toBe(true);
      expect(canView(row("public"), null, { asDirectLink: true })).toBe(true);
    });
  });

  describe("unlisted content", () => {
    it("is viewable by the owner", () => {
      expect(canView(row("unlisted"), owner)).toBe(true);
    });
    it("is viewable by another user on a direct link", () => {
      expect(canView(row("unlisted"), other, { asDirectLink: true })).toBe(true);
    });
    it("is viewable by a logged-out visitor on a direct link", () => {
      expect(canView(row("unlisted"), null, { asDirectLink: true })).toBe(true);
    });
    it("is NOT visible in a listing to another user", () => {
      expect(canView(row("unlisted"), other, { asDirectLink: false })).toBe(false);
    });
    it("is NOT visible in a listing to a logged-out visitor", () => {
      expect(canView(row("unlisted"), null, { asDirectLink: false })).toBe(false);
    });
    it("defaults to the listing rule when asDirectLink is omitted", () => {
      expect(canView(row("unlisted"), other)).toBe(false);
      expect(canView(row("unlisted"), null)).toBe(false);
    });
  });

  describe("private content", () => {
    it("is viewable by the owner", () => {
      expect(canView(row("private"), owner)).toBe(true);
      expect(canView(row("private"), owner, { asDirectLink: true })).toBe(true);
    });
    it("is NOT viewable by another user", () => {
      expect(canView(row("private"), other)).toBe(false);
      expect(canView(row("private"), other, { asDirectLink: true })).toBe(false);
    });
    it("is NOT viewable by a logged-out visitor", () => {
      expect(canView(row("private"), null)).toBe(false);
      expect(canView(row("private"), null, { asDirectLink: true })).toBe(false);
    });
  });
});
