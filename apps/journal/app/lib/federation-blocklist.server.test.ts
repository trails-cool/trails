import { describe, it, expect } from "vitest";
import { hostOfIri } from "./federation-blocklist.server.ts";

describe("hostOfIri", () => {
  it("extracts the host from an actor/object IRI", () => {
    expect(hostOfIri("https://mastodon.social/users/alice")).toBe("mastodon.social");
    expect(hostOfIri("https://sub.example.com:8443/x")).toBe("sub.example.com:8443");
  });

  it("returns null for an unparseable IRI", () => {
    expect(hostOfIri("not a url")).toBeNull();
    expect(hostOfIri("")).toBeNull();
  });
});
