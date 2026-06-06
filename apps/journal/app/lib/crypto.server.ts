// AES-256-GCM encrypt/decrypt for storing sensitive credentials at rest.
// Keys are derived from a secret env var using scrypt.
//
// Encoded format: base64(iv_hex:ciphertext_hex:authtag_hex)
// All fields are hex-encoded before joining so the separator is unambiguous.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const KEY_LEN = 32; // AES-256
const IV_LEN = 12; // GCM standard

export interface AesCipher {
  encrypt(plaintext: string): string;
  decrypt(encoded: string): string;
}

/**
 * Build an encrypt/decrypt pair keyed from `secretEnvVar`. The key is
 * derived lazily on first use so importing this module never throws —
 * only actually encrypting/decrypting requires the env var to be set.
 * Distinct `salt` per use-case keeps derived keys independent even if
 * two env vars were ever set to the same value.
 */
export function createAesCipher(secretEnvVar: string, salt: string): AesCipher {
  function getKey(): Buffer {
    const secret = process.env[secretEnvVar];
    if (!secret) throw new Error(`${secretEnvVar} env var is not set`);
    return scryptSync(secret, salt, KEY_LEN) as Buffer;
  }

  return {
    encrypt(plaintext: string): string {
      const key = getKey();
      const iv = randomBytes(IV_LEN);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const payload = [iv.toString("hex"), encrypted.toString("hex"), authTag.toString("hex")].join(":");
      return Buffer.from(payload).toString("base64");
    },
    decrypt(encoded: string): string {
      const key = getKey();
      const payload = Buffer.from(encoded, "base64").toString("utf8");
      const parts = payload.split(":");
      if (parts.length !== 3) throw new Error("Invalid encrypted payload format");
      const [ivHex, encryptedHex, authTagHex] = parts as [string, string, string];
      const iv = Buffer.from(ivHex, "hex");
      const encrypted = Buffer.from(encryptedHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      return decipher.update(encrypted) + decipher.final("utf8");
    },
  };
}

// Integration-credential cipher (Komoot web-login, etc). Pre-existing
// callers import { encrypt, decrypt } directly; keep that surface.
const integrations = createAesCipher("INTEGRATION_SECRET", "trails-cool-integrations");
export const encrypt = integrations.encrypt;
export const decrypt = integrations.decrypt;
