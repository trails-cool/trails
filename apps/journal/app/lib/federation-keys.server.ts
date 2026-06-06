// Per-user federation signing keypairs (spec: social-federation,
// "Per-user signing keypairs").
//
// Every federating user has an RSA keypair: the public key is embedded
// in their actor object for inbound signature verification by remotes;
// the private key signs our outbound requests (HTTP Signatures). Keys
// are stored as JWK JSON on journal.users — public in plaintext,
// private encrypted at rest with FEDERATION_KEY_ENCRYPTION_KEY.
//
// RSASSA-PKCS1-v1_5 (RSA 2048) is the algorithm Mastodon and the wider
// fediverse interoperate on for HTTP Signatures; Ed25519 support is
// still patchy across implementations.
//
// Key-rotation runbook: rotating FEDERATION_KEY_ENCRYPTION_KEY requires
// decrypt-with-old + encrypt-with-new over journal.users — documented in
// docs/deployment.md (task 10.2).

import { generateCryptoKeyPair, exportJwk, importJwk } from "@fedify/fedify";
import { and, eq, isNull } from "drizzle-orm";
import { users } from "@trails-cool/db/schema/journal";
import { getDb } from "./db.ts";
import { createAesCipher } from "./crypto.server.ts";
import { requireSecret } from "./config.server.ts";

const cipher = createAesCipher("FEDERATION_KEY_ENCRYPTION_KEY", "trails-cool-federation-keys");

/**
 * Fail fast in production when the encryption key is missing or the
 * known-public dev fallback. Called before any key material is written.
 */
function assertEncryptionKeyConfigured(): void {
  requireSecret("FEDERATION_KEY_ENCRYPTION_KEY", "dev-only-federation-key");
  // requireSecret throws in prod for unset/fallback values; in dev it
  // returns the fallback, which createAesCipher's env lookup won't see —
  // so mirror it into the env for the cipher when unset.
  process.env.FEDERATION_KEY_ENCRYPTION_KEY ??= "dev-only-federation-key";
}

export interface SerializedKeypair {
  publicKey: string;
  privateKeyEncrypted: string;
}

/** Generate a fresh RSA 2048 keypair, serialized for journal.users. */
export async function generateUserKeypair(): Promise<SerializedKeypair> {
  assertEncryptionKeyConfigured();
  const { publicKey, privateKey } = await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
  return {
    publicKey: JSON.stringify(await exportJwk(publicKey)),
    privateKeyEncrypted: cipher.encrypt(JSON.stringify(await exportJwk(privateKey))),
  };
}

/**
 * Generate and store a keypair for `userId` if it doesn't have one.
 * Concurrency-safe: the UPDATE is guarded on `public_key IS NULL`, so
 * a racing generation loses and the first written pair stays canonical.
 * Returns true when this call generated the pair.
 */
export async function ensureUserKeypair(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ publicKey: users.publicKey })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row || row.publicKey !== null) return false;
  const pair = await generateUserKeypair();
  const updated = await db
    .update(users)
    .set({ publicKey: pair.publicKey, privateKeyEncrypted: pair.privateKeyEncrypted })
    .where(and(eq(users.id, userId), isNull(users.publicKey)))
    .returning({ id: users.id });
  return updated.length > 0;
}

/** Deserialize a user's stored keypair into CryptoKeys for Fedify. */
export async function loadUserKeypair(row: {
  publicKey: string | null;
  privateKeyEncrypted: string | null;
}): Promise<CryptoKeyPair | null> {
  if (!row.publicKey || !row.privateKeyEncrypted) return null;
  assertEncryptionKeyConfigured();
  return {
    publicKey: await importJwk(JSON.parse(row.publicKey), "public"),
    privateKey: await importJwk(JSON.parse(cipher.decrypt(row.privateKeyEncrypted)), "private"),
  };
}

/** All user ids still lacking a keypair (backfill workload). */
export async function listUsersWithoutKeypair(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(isNull(users.publicKey));
  return rows.map((r) => r.id);
}
