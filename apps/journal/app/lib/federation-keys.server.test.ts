import { describe, it, expect, beforeEach } from "vitest";

beforeEach(() => {
  process.env.FEDERATION_KEY_ENCRYPTION_KEY = "test-federation-key-secret";
});

const { generateUserKeypair, loadUserKeypair } = await import(
  "./federation-keys.server.ts"
);

describe("federation keypairs", () => {
  it("generates a serializable RSA keypair with encrypted private key", async () => {
    const pair = await generateUserKeypair();

    const publicJwk = JSON.parse(pair.publicKey);
    expect(publicJwk.kty).toBe("RSA");
    // 2048-bit modulus → 256 bytes → 342 base64url chars (spec wants RSA 2048)
    expect(publicJwk.n.length).toBeGreaterThanOrEqual(342);

    // Private key must not be stored as plaintext JWK
    expect(pair.privateKeyEncrypted).not.toContain('"kty"');
    expect(() => JSON.parse(pair.privateKeyEncrypted)).toThrow();
  });

  it("roundtrips through load into usable CryptoKeys that sign and verify", async () => {
    const stored = await generateUserKeypair();
    const loaded = await loadUserKeypair(stored);
    expect(loaded).not.toBeNull();

    const data = new TextEncoder().encode("signed federation payload");
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      loaded!.privateKey,
      data,
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      loaded!.publicKey,
      signature,
      data,
    );
    expect(valid).toBe(true);
  });

  it("returns null for users without stored keys", async () => {
    expect(await loadUserKeypair({ publicKey: null, privateKeyEncrypted: null })).toBeNull();
  });

  it("fails to load when the encryption key is wrong", async () => {
    const stored = await generateUserKeypair();
    process.env.FEDERATION_KEY_ENCRYPTION_KEY = "a-different-secret";
    await expect(loadUserKeypair(stored)).rejects.toThrow();
  });
});
