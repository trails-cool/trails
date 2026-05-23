// AES-256-GCM encrypt/decrypt for storing sensitive integration credentials.
// Key is derived from INTEGRATION_SECRET env var using scrypt.
//
// Encoded format: base64(salt_hex:iv_hex:ciphertext_hex:authtag_hex)
// All fields are hex-encoded before joining so the separator is unambiguous.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SALT = "trails-cool-integrations";
const KEY_LEN = 32; // AES-256
const IV_LEN = 12; // GCM standard

function getKey(): Buffer {
  const secret = process.env.INTEGRATION_SECRET;
  if (!secret) throw new Error("INTEGRATION_SECRET env var is not set");
  return scryptSync(secret, SALT, KEY_LEN) as Buffer;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = [iv.toString("hex"), encrypted.toString("hex"), authTag.toString("hex")].join(":");
  return Buffer.from(payload).toString("base64");
}

export function decrypt(encoded: string): string {
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
}
