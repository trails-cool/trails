import { describe, it, expect, vi } from "vitest";

vi.mock("./db.ts", () => ({ getDb: () => ({}) }));

const { parseRemoteHandle, isTrailsSoftware } = await import("./federation-outbound.server.ts");

describe("parseRemoteHandle", () => {
  it("accepts the common handle spellings", () => {
    expect(parseRemoteHandle("@alice@other.example")).toEqual({ username: "alice", host: "other.example" });
    expect(parseRemoteHandle("alice@other.example")).toEqual({ username: "alice", host: "other.example" });
    expect(parseRemoteHandle("acct:alice@other.example")).toEqual({ username: "alice", host: "other.example" });
    expect(parseRemoteHandle("  @alice@other.example  ")).toEqual({ username: "alice", host: "other.example" });
    expect(parseRemoteHandle("@a_l-i.ce@sub.other.example")).toEqual({ username: "a_l-i.ce", host: "sub.other.example" });
  });

  it("lowercases hosts but preserves username case", () => {
    expect(parseRemoteHandle("@Alice@Other.Example")).toEqual({ username: "Alice", host: "other.example" });
  });

  it("accepts a port (dev instances)", () => {
    expect(parseRemoteHandle("@bob@localhost:3000")).toBeNull(); // bare hostname without TLD is rejected
    expect(parseRemoteHandle("@bob@staging.trails.cool:3000")).toEqual({ username: "bob", host: "staging.trails.cool:3000" });
  });

  it("rejects everything else", () => {
    expect(parseRemoteHandle("alice")).toBeNull();
    expect(parseRemoteHandle("https://other.example/users/alice")).toBeNull();
    expect(parseRemoteHandle("@@broken@host.example")).toBeNull();
    expect(parseRemoteHandle("")).toBeNull();
  });
});

describe("isTrailsSoftware", () => {
  it("accepts trails-cool and nothing else", () => {
    expect(isTrailsSoftware("trails-cool")).toBe(true);
    expect(isTrailsSoftware("mastodon")).toBe(false);
    expect(isTrailsSoftware("hollo")).toBe(false);
    expect(isTrailsSoftware(undefined)).toBe(false);
  });
});
