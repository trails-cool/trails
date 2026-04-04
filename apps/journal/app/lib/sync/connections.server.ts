import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db.ts";
import { syncConnections } from "@trails-cool/db/schema/journal";
import type { TokenSet } from "./types.ts";

export async function saveConnection(
  userId: string,
  provider: string,
  tokens: TokenSet,
) {
  const db = getDb();
  // Upsert: delete existing connection for this user+provider, then insert
  await db
    .delete(syncConnections)
    .where(and(eq(syncConnections.userId, userId), eq(syncConnections.provider, provider)));
  await db.insert(syncConnections).values({
    id: randomUUID(),
    userId,
    provider,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    providerUserId: tokens.providerUserId ?? null,
  });
}

export async function getConnection(userId: string, provider: string) {
  const db = getDb();
  const [conn] = await db
    .select()
    .from(syncConnections)
    .where(and(eq(syncConnections.userId, userId), eq(syncConnections.provider, provider)));
  return conn ?? null;
}

export async function getConnectionByProviderUser(provider: string, providerUserId: string) {
  const db = getDb();
  const [conn] = await db
    .select()
    .from(syncConnections)
    .where(
      and(eq(syncConnections.provider, provider), eq(syncConnections.providerUserId, providerUserId)),
    );
  return conn ?? null;
}

export async function updateTokens(
  connectionId: string,
  tokens: TokenSet,
) {
  const db = getDb();
  await db
    .update(syncConnections)
    .set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    })
    .where(eq(syncConnections.id, connectionId));
}

export async function deleteConnection(userId: string, provider: string) {
  const db = getDb();
  await db
    .delete(syncConnections)
    .where(and(eq(syncConnections.userId, userId), eq(syncConnections.provider, provider)));
}
