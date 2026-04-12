import { randomUUID, randomBytes, createHash } from "node:crypto";
import { eq, and, gt, isNull } from "drizzle-orm";
import { getDb } from "./db.ts";
import {
  users,
  oauthClients,
  oauthCodes,
  oauthTokens,
} from "@trails-cool/db/schema/journal";
import { getSessionUser } from "./auth.server.ts";

const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

// --- Client validation ---

export async function getOAuthClient(clientId: string) {
  const db = getDb();
  const [client] = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId));
  return client ?? null;
}

export function validateRedirectUri(
  client: { redirectUri: string },
  redirectUri: string,
): boolean {
  return client.redirectUri === redirectUri;
}

// --- Authorization code ---

export async function createAuthorizationCode(params: {
  userId: string;
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
}): Promise<string> {
  const db = getDb();
  const code = generateToken();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

  await db.insert(oauthCodes).values({
    id: randomUUID(),
    code,
    userId: params.userId,
    clientId: params.clientId,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    redirectUri: params.redirectUri,
    expiresAt,
  });

  return code;
}

// --- PKCE verification ---

function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string,
): boolean {
  if (method === "S256") {
    const hash = createHash("sha256").update(codeVerifier).digest("base64url");
    return hash === codeChallenge;
  }
  if (method === "plain") {
    return codeVerifier === codeChallenge;
  }
  return false;
}

// --- Token exchange ---

export async function exchangeCodeForTokens(params: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  deviceName?: string;
}) {
  const db = getDb();

  const [record] = await db
    .select()
    .from(oauthCodes)
    .where(
      and(
        eq(oauthCodes.code, params.code),
        eq(oauthCodes.clientId, params.clientId),
        gt(oauthCodes.expiresAt, new Date()),
        isNull(oauthCodes.usedAt),
      ),
    );

  if (!record) {
    throw new OAuthError("invalid_grant", "Invalid or expired authorization code");
  }

  if (record.redirectUri !== params.redirectUri) {
    throw new OAuthError("invalid_grant", "Redirect URI mismatch");
  }

  if (!verifyCodeChallenge(params.codeVerifier, record.codeChallenge, record.codeChallengeMethod)) {
    throw new OAuthError("invalid_grant", "PKCE verification failed");
  }

  // Mark code as used
  await db
    .update(oauthCodes)
    .set({ usedAt: new Date() })
    .where(eq(oauthCodes.id, record.id));

  return issueTokens(record.userId, params.clientId, params.deviceName);
}

// --- Refresh token ---

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  deviceName?: string;
}) {
  const db = getDb();

  const [record] = await db
    .select()
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.refreshToken, params.refreshToken),
        eq(oauthTokens.clientId, params.clientId),
        isNull(oauthTokens.revokedAt),
      ),
    );

  if (!record) {
    throw new OAuthError("invalid_grant", "Invalid refresh token");
  }

  // Revoke old token pair
  await db
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(eq(oauthTokens.id, record.id));

  // Issue fresh tokens (token rotation)
  return issueTokens(record.userId, params.clientId, params.deviceName ?? record.deviceName ?? undefined);
}

// --- Token issuance ---

async function issueTokens(userId: string, clientId: string, deviceName?: string) {
  const db = getDb();
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MS);

  await db.insert(oauthTokens).values({
    id: randomUUID(),
    accessToken,
    refreshToken,
    userId,
    clientId,
    deviceName: deviceName ?? null,
    expiresAt,
    lastActiveAt: new Date(),
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer" as const,
    expires_in: Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000),
  };
}

// --- Bearer token validation (middleware) ---

export async function validateBearerToken(request: Request) {
  const db = getDb();
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const [record] = await db
    .select()
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.accessToken, token),
        isNull(oauthTokens.revokedAt),
      ),
    );

  if (!record) return null;

  // Check if access token is expired — but don't reject (client should refresh)
  // We still allow expired access tokens for a grace period; the client
  // gets a 401 which triggers a refresh flow
  if (record.expiresAt < new Date()) return null;

  // Update last active timestamp
  await db
    .update(oauthTokens)
    .set({ lastActiveAt: new Date() })
    .where(eq(oauthTokens.id, record.id));

  return { userId: record.userId, tokenId: record.id };
}

// --- Seed trusted client ---

export async function seedOAuthClient(
  clientId: string,
  redirectUri: string,
  trusted: boolean,
) {
  const db = getDb();
  await db
    .insert(oauthClients)
    .values({
      clientId,
      redirectUri,
      trusted: trusted ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: oauthClients.clientId,
      set: { redirectUri, trusted: trusted ? 1 : 0 },
    });
}

// --- Combined auth: cookie session OR bearer token ---

/**
 * Authenticate a request via cookie session or OAuth2 bearer token.
 * Use this in API routes that both the web UI and mobile app call.
 */
export async function getAuthenticatedUser(request: Request) {
  // Try cookie session first (web UI)
  const sessionUser = await getSessionUser(request);
  if (sessionUser) return sessionUser;

  // Try bearer token (mobile app)
  const tokenResult = await validateBearerToken(request);
  if (!tokenResult) return null;

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, tokenResult.userId));
  return user ?? null;
}

// --- Error type ---

export class OAuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
