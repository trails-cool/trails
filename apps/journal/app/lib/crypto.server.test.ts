import { describe, it, expect, beforeEach } from "vitest";

// Set env before importing module
beforeEach(() => {
  process.env.INTEGRATION_SECRET = "test-secret-for-unit-tests";
});

const { encrypt, decrypt } = await import("./crypto.server.ts");

describe("crypto.server", () => {
  it("roundtrips ASCII plaintext", () => {
    const plaintext = "hello world";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("roundtrips unicode plaintext", () => {
    const plaintext = "Über dich 🏔️ trails.cool";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("produces different ciphertext for the same input (random IV)", () => {
    const plaintext = "same input";
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);
    expect(c1).not.toBe(c2);
    // But both decrypt correctly
    expect(decrypt(c1)).toBe(plaintext);
    expect(decrypt(c2)).toBe(plaintext);
  });

  it("throws on tampered auth tag", () => {
    const encoded = encrypt("sensitive");
    // Decode the base64 payload, split on ":", flip bytes in the auth tag
    const payload = Buffer.from(encoded, "base64").toString("utf8");
    const parts = payload.split(":");
    // parts: [ivHex, encryptedHex, authTagHex]
    const authTagBuf = Buffer.from(parts[2]!, "hex");
    authTagBuf[0] = authTagBuf[0]! ^ 0xff;
    parts[2] = authTagBuf.toString("hex");
    const tampered = Buffer.from(parts.join(":")).toString("base64");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on invalid format", () => {
    expect(() => decrypt(Buffer.from("notvalidformat").toString("base64"))).toThrow(
      "Invalid encrypted payload format",
    );
  });
});
