// COMPATIBILITY SHIM — translates the legacy TokenSet-shaped API onto the
// new connected_services / JSONB-credentials schema introduced by
// deepen-connected-services. Once the routes and pushes.server.ts migrate
// to ConnectedServiceManager (tasks 5.x of the change), this whole file
// (and the rest of apps/journal/app/lib/sync/) goes away.
//
// Do not add new callers. Use apps/journal/app/lib/connected-services/
// directly.

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.ts";
import { connectedServices } from "@trails-cool/db/schema/journal";
import type { TokenSet } from "./types.ts";

interface OAuthBlob {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface LegacyConnection {
  id: string;
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  providerUserId: string | null;
  grantedScopes: string[];
  createdAt: Date;
}

function toLegacy(row: typeof connectedServices.$inferSelect): LegacyConnection {
  const blob = row.credentials as OAuthBlob;
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    accessToken: blob.access_token,
    refreshToken: blob.refresh_token,
    expiresAt: new Date(blob.expires_at),
    providerUserId: row.providerUserId,
    grantedScopes: row.grantedScopes,
    createdAt: row.createdAt,
  };
}

function toBlob(tokens: TokenSet): OAuthBlob {
  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: tokens.expiresAt.toISOString(),
  };
}

export async function saveConnection(
  userId: string,
  provider: string,
  tokens: TokenSet,
  grantedScopes: string[] = [],
) {
  const db = getDb();
  await db
    .delete(connectedServices)
    .where(
      and(eq(connectedServices.userId, userId), eq(connectedServices.provider, provider)),
    );
  await db.insert(connectedServices).values({
    id: randomUUID(),
    userId,
    provider,
    credentialKind: "oauth",
    credentials: toBlob(tokens),
    status: "active",
    providerUserId: tokens.providerUserId ?? null,
    grantedScopes,
  });
}

export async function getConnection(
  userId: string,
  provider: string,
): Promise<LegacyConnection | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(connectedServices)
    .where(
      and(eq(connectedServices.userId, userId), eq(connectedServices.provider, provider)),
    );
  return row ? toLegacy(row) : null;
}

export async function getConnectionByProviderUser(
  provider: string,
  providerUserId: string,
): Promise<LegacyConnection | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(connectedServices)
    .where(
      and(
        eq(connectedServices.provider, provider),
        eq(connectedServices.providerUserId, providerUserId),
      ),
    );
  return row ? toLegacy(row) : null;
}

export async function updateTokens(connectionId: string, tokens: TokenSet) {
  const db = getDb();
  await db
    .update(connectedServices)
    .set({ credentials: toBlob(tokens) })
    .where(eq(connectedServices.id, connectionId));
}

export async function deleteConnection(userId: string, provider: string) {
  const db = getDb();
  await db
    .delete(connectedServices)
    .where(
      and(eq(connectedServices.userId, userId), eq(connectedServices.provider, provider)),
    );
}
