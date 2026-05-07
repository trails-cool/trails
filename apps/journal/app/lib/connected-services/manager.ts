// ConnectedServiceManager — owns credential lifecycle for every provider.
//
// Importers, route pushers, and webhook handlers obtain credentials
// EXCLUSIVELY through withFreshCredentials. They never read the
// `credentials` JSONB blob directly.
//
// See docs/adr/0001-0003 and CONTEXT.md (Connected Services).

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { connectedServices } from "@trails-cool/db/schema/journal";
import { getDb } from "../db.ts";
import {
  ConnectionNotActiveError,
  NeedsRelinkError,
  type ConnectedService,
  type CredentialKind,
  type Credentials,
  type ConnectionStatus,
} from "./types.ts";
import { getManifest, type CapabilityContext } from "./registry.ts";

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

type Row = typeof connectedServices.$inferSelect;

function toModel(row: Row): ConnectedService {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    credentialKind: row.credentialKind as CredentialKind,
    credentials: row.credentials as Credentials,
    status: row.status as ConnectionStatus,
    providerUserId: row.providerUserId,
    grantedScopes: row.grantedScopes,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export async function getService(
  userId: string,
  provider: string,
): Promise<ConnectedService | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(connectedServices)
    .where(
      and(eq(connectedServices.userId, userId), eq(connectedServices.provider, provider)),
    );
  return row ? toModel(row) : null;
}

export async function getServiceById(
  serviceId: string,
): Promise<ConnectedService | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(connectedServices)
    .where(eq(connectedServices.id, serviceId));
  return row ? toModel(row) : null;
}

export async function getServiceByProviderUser(
  provider: string,
  providerUserId: string,
): Promise<ConnectedService | null> {
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
  return row ? toModel(row) : null;
}

// ---------------------------------------------------------------------------
// Mutation: link / unlink / status
// ---------------------------------------------------------------------------

export interface LinkInput {
  userId: string;
  provider: string;
  credentialKind: CredentialKind;
  credentials: Credentials;
  providerUserId?: string | null;
  grantedScopes?: string[];
}

// Upsert the (user_id, provider) row with fresh credentials. The DB-level
// unique constraint on (user_id, provider) guarantees at most one row per
// pair; we delete-then-insert to keep the row id stable per link, which
// also resets `created_at`.
export async function link(input: LinkInput): Promise<ConnectedService> {
  const db = getDb();
  await db
    .delete(connectedServices)
    .where(
      and(
        eq(connectedServices.userId, input.userId),
        eq(connectedServices.provider, input.provider),
      ),
    );
  const id = randomUUID();
  await db.insert(connectedServices).values({
    id,
    userId: input.userId,
    provider: input.provider,
    credentialKind: input.credentialKind,
    credentials: input.credentials,
    status: "active",
    providerUserId: input.providerUserId ?? null,
    grantedScopes: input.grantedScopes ?? [],
  });
  const row = await getServiceById(id);
  if (!row) throw new Error("Failed to load just-linked service");
  return row;
}

export async function unlink(serviceId: string): Promise<void> {
  const db = getDb();
  // Best-effort revoke at the provider before deleting locally.
  const service = await getServiceById(serviceId);
  if (service) {
    const manifest = getManifest(service.provider);
    if (manifest?.credentialAdapter.revoke && manifest.oauthConfig) {
      await manifest.credentialAdapter
        .revoke(service.credentials, manifest.oauthConfig)
        .catch(() => {
          // Swallow — local delete proceeds regardless.
        });
    }
  }
  await db.delete(connectedServices).where(eq(connectedServices.id, serviceId));
}

export async function unlinkByUserProvider(
  userId: string,
  provider: string,
): Promise<void> {
  const service = await getService(userId, provider);
  if (!service) return;
  await unlink(service.id);
}

export async function markNeedsRelink(
  serviceId: string,
  reason: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(connectedServices)
    .set({ status: "needs_relink" })
    .where(eq(connectedServices.id, serviceId));
  // Reason is logged but not persisted yet — add a column if/when we surface it in UI.
  console.warn(`[connected-services] ${serviceId} flipped to needs_relink: ${reason}`);
}

export async function updateGrantedScopes(
  serviceId: string,
  grantedScopes: string[],
): Promise<void> {
  const db = getDb();
  await db
    .update(connectedServices)
    .set({ grantedScopes })
    .where(eq(connectedServices.id, serviceId));
}

// ---------------------------------------------------------------------------
// withFreshCredentials — the chokepoint
// ---------------------------------------------------------------------------

// Loads the connection, refreshes credentials if expired, calls fn with the
// fresh credentials. On a NeedsRelinkError from the adapter, flips the
// connection to needs_relink and re-throws so the caller can surface a
// re-link prompt.
//
// Capability adapters use this exclusively — they never read the
// credentials JSONB directly.
export async function withFreshCredentials<T>(
  serviceId: string,
  fn: (credentials: unknown) => Promise<T>,
): Promise<T> {
  const service = await getServiceById(serviceId);
  if (!service) throw new Error(`Connected service ${serviceId} not found`);
  if (service.status !== "active") {
    throw new ConnectionNotActiveError(service.status);
  }

  const manifest = getManifest(service.provider);
  if (!manifest) {
    throw new Error(`No manifest registered for provider ${service.provider}`);
  }
  const adapter = manifest.credentialAdapter;

  let creds = service.credentials;
  if (adapter.isExpired(creds)) {
    if (!manifest.oauthConfig && service.credentialKind === "oauth") {
      throw new Error(
        `Provider ${service.provider} has no oauthConfig; cannot refresh`,
      );
    }
    try {
      creds = await adapter.refresh(creds, manifest.oauthConfig!);
      const db = getDb();
      await db
        .update(connectedServices)
        .set({ credentials: creds })
        .where(eq(connectedServices.id, serviceId));
    } catch (err) {
      if (err instanceof NeedsRelinkError) {
        await markNeedsRelink(serviceId, err.reason);
      }
      throw err;
    }
  }

  return fn(creds);
}

// Build a CapabilityContext bound to a service id. Capability adapters
// receive this from the route handler / job that invoked them.
export function capabilityContextFor(serviceId: string): CapabilityContext {
  return {
    serviceId,
    withFreshCredentials: (fn) => withFreshCredentials(serviceId, fn),
  };
}
