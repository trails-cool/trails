import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "./crypto.server";

beforeAll(() => {
  process.env.INTEGRATION_SECRET = "test-secret-for-unit-tests";
});

describe("crypto", () => {
  it("encrypts and decrypts a string", () => {
    const plaintext = "my-secret-password-123";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext for the same input", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("handles unicode", () => {
    const plaintext = "Passwort mit Ümlauten: äöü 🏔️";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("secret");
    const tampered = encrypted.slice(0, -2) + "XX";
    expect(() => decrypt(tampered)).toThrow();
  });
});
