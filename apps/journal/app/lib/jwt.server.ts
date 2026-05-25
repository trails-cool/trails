import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { getOrigin, requireSecret } from "./config.server.ts";
import { getDb } from "./db.ts";
import { consumedJwtJti } from "@trails-cool/db/schema/journal";

const JWT_SECRET = new TextEncoder().encode(
  requireSecret("JWT_SECRET", "dev-jwt-secret-change-in-production"),
);

const ISSUER = getOrigin();

export async function createRouteToken(routeId: string, permissions: string[] = ["read", "write"]): Promise<string> {
  return new SignJWT({ route_id: routeId, permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setExpirationTime("7d")
    .setIssuedAt()
    .setJti(randomUUID())
    .sign(JWT_SECRET);
}

export class TokenAlreadyConsumedError extends Error {
  constructor() {
    super("Token already consumed");
    this.name = "TokenAlreadyConsumedError";
  }
}

/**
 * Verify a route token AND atomically consume it. Subsequent calls
 * with the same token throw `TokenAlreadyConsumedError`.
 *
 * The consume step is `INSERT … ON CONFLICT DO NOTHING RETURNING jti`.
 * Postgres serializes the insert against concurrent attempts, so
 * exactly one caller observes the returned row — the rest see an
 * empty result and reject.
 *
 * Tokens minted before this PR (no `jti` claim) are rejected outright,
 * which is the right behavior: pre-existing tokens are already in
 * planner-session DB rows and would be replayable if accepted. The
 * user re-saves by going back to the journal for a fresh token.
 */
export async function verifyRouteToken(token: string): Promise<{ routeId: string; permissions: string[] }> {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    issuer: ISSUER,
  });

  if (typeof payload.jti !== "string" || !payload.jti) {
    throw new TokenAlreadyConsumedError();
  }
  if (typeof payload.exp !== "number") {
    throw new TokenAlreadyConsumedError();
  }

  const db = getDb();
  const inserted = await db
    .insert(consumedJwtJti)
    .values({
      jti: payload.jti,
      expiresAt: new Date(payload.exp * 1000),
    })
    .onConflictDoNothing()
    .returning({ jti: consumedJwtJti.jti });

  if (inserted.length === 0) {
    throw new TokenAlreadyConsumedError();
  }

  return {
    routeId: payload.route_id as string,
    permissions: payload.permissions as string[],
  };
}
