import { describe, it, expect, vi, beforeEach } from "vitest";

// Spike validation (social-federation task 1.1): exercise Fedify's URL
// dispatcher the way a remote AP client would — WebFinger lookup, then
// actor fetch with an ActivityPub Accept header — without a running
// server or database.

const dbUsers: Array<Record<string, unknown>> = [];

vi.mock("./db.ts", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => dbUsers,
        }),
      }),
    }),
  }),
}));

const { handleFederationRequest, wantsActivityJson, federationSourceHost } = await import(
  "./federation.server.ts"
);

const PUBLIC_USER = {
  id: "u1",
  username: "bruno",
  displayName: "Bruno",
  bio: "Riding bikes",
  domain: "localhost",
  profileVisibility: "public",
};

function webfingerRequest(handle: string): Request {
  return new Request(
    `http://localhost:3000/.well-known/webfinger?resource=${encodeURIComponent(handle)}`,
    { headers: { accept: "application/jrd+json" } },
  );
}

function actorRequest(username: string): Request {
  return new Request(`http://localhost:3000/users/${username}`, {
    headers: { accept: "application/activity+json" },
  });
}

beforeEach(() => {
  process.env.FEDERATION_ENABLED = "true";
  dbUsers.length = 0;
});

describe("federation flag", () => {
  it("404s every federation request when FEDERATION_ENABLED is off", async () => {
    process.env.FEDERATION_ENABLED = "false";
    dbUsers.push(PUBLIC_USER);
    const res = await handleFederationRequest(webfingerRequest("acct:bruno@localhost:3000"));
    expect(res.status).toBe(404);
  });
});

describe("WebFinger", () => {
  it("resolves a public user's handle to their actor IRI", async () => {
    dbUsers.push(PUBLIC_USER);
    const res = await handleFederationRequest(webfingerRequest("acct:bruno@localhost:3000"));
    expect(res.status).toBe(200);
    const jrd = await res.json();
    expect(jrd.subject).toBe("acct:bruno@localhost:3000");
    const self = jrd.links.find((l: { rel: string }) => l.rel === "self");
    expect(self.href).toBe("http://localhost:3000/users/bruno");
    expect(self.type).toContain("application/activity+json");
  });

  it("404s for a private user without leaking existence", async () => {
    dbUsers.push({ ...PUBLIC_USER, profileVisibility: "private" });
    const res = await handleFederationRequest(webfingerRequest("acct:bruno@localhost:3000"));
    expect(res.status).toBe(404);
  });

  it("404s for an unknown user", async () => {
    const res = await handleFederationRequest(webfingerRequest("acct:ghost@localhost:3000"));
    expect(res.status).toBe(404);
  });
});

describe("actor object", () => {
  it("serves a Person actor for a public user", async () => {
    dbUsers.push(PUBLIC_USER);
    const res = await handleFederationRequest(actorRequest("bruno"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/activity+json");
    const actor = await res.json();
    expect(actor.type).toBe("Person");
    expect(actor.id).toBe("http://localhost:3000/users/bruno");
    expect(actor.preferredUsername).toBe("bruno");
    expect(actor.name).toBe("Bruno");
    expect(actor.summary).toBe("Riding bikes");
    // Profile-metadata field Mastodon renders ("this is a trails profile")
    const attachments = Array.isArray(actor.attachment) ? actor.attachment : [actor.attachment];
    const field = attachments.find((a: { type: string }) => a?.type === "PropertyValue");
    expect(field?.name).toBe("🥾 trails.cool");
    expect(field?.value).toContain('href="http://localhost:3000/users/bruno"');
    expect(field?.value).toContain('rel="me"');
  });

  it("404s the actor for a private user", async () => {
    dbUsers.push({ ...PUBLIC_USER, profileVisibility: "private" });
    const res = await handleFederationRequest(actorRequest("bruno"));
    expect(res.status).toBe(404);
  });
});

describe("federationSourceHost", () => {
  it("extracts the host from the HTTP Signature keyId", () => {
    const req = new Request("http://localhost:3000/users/bruno/inbox", {
      method: "POST",
      headers: {
        signature:
          'keyId="https://mastodon.social/users/alice#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="abc=="',
      },
    });
    expect(federationSourceHost(req)).toBe("mastodon.social");
  });

  it("buckets unsigned or malformed requests as unknown", () => {
    expect(
      federationSourceHost(new Request("http://localhost:3000/users/bruno/inbox", { method: "POST" })),
    ).toBe("unknown");
    expect(
      federationSourceHost(
        new Request("http://localhost:3000/users/bruno/inbox", {
          method: "POST",
          headers: { signature: 'keyId="not a url",signature="x"' },
        }),
      ),
    ).toBe("unknown");
  });
});

describe("wantsActivityJson", () => {
  it("matches AP client Accept headers, not browsers", () => {
    expect(wantsActivityJson(actorRequest("bruno"))).toBe(true);
    expect(
      wantsActivityJson(
        new Request("http://localhost:3000/users/bruno", {
          // Mastodon's exact Accept header
          headers: {
            accept:
              'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
          },
        }),
      ),
    ).toBe(true);
    expect(
      wantsActivityJson(
        new Request("http://localhost:3000/users/bruno", {
          headers: { accept: "text/html,application/xhtml+xml" },
        }),
      ),
    ).toBe(false);
  });
});
