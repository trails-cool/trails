import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateFetchUrl,
  validateRedirectUrl,
  getCallbackAllowedHosts,
} from "./url-validation.server.ts";

describe("validateFetchUrl", () => {
  it("accepts a plain https URL", () => {
    expect(validateFetchUrl("https://journal.trails.cool/api/cb").ok).toBe(true);
  });

  it("rejects javascript: scheme", () => {
    const r = validateFetchUrl("javascript:alert(1)");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/scheme/);
  });

  it("rejects file: scheme", () => {
    expect(validateFetchUrl("file:///etc/passwd").ok).toBe(false);
  });

  it("rejects relative paths (must be absolute)", () => {
    expect(validateFetchUrl("/foo/bar").ok).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(validateFetchUrl("not a url").ok).toBe(false);
  });

  it("rejects oversized input", () => {
    expect(validateFetchUrl("https://" + "x".repeat(3000) + ".test").ok).toBe(false);
  });

  it("enforces the host allowlist when provided", () => {
    const allowed = ["journal.trails.cool"];
    expect(validateFetchUrl("https://journal.trails.cool/x", { allowedHosts: allowed }).ok).toBe(true);
    expect(validateFetchUrl("https://evil.example/x", { allowedHosts: allowed }).ok).toBe(false);
  });

  it("ignores the allowlist when it's empty/undefined", () => {
    expect(validateFetchUrl("https://random.example/x").ok).toBe(true);
    expect(validateFetchUrl("https://random.example/x", { allowedHosts: [] }).ok).toBe(true);
  });
});

describe("validateRedirectUrl", () => {
  it("accepts an absolute https URL", () => {
    expect(validateRedirectUrl("https://trails.cool/r/123").ok).toBe(true);
  });

  it("accepts a same-origin relative path", () => {
    expect(validateRedirectUrl("/routes/abc").ok).toBe(true);
  });

  it("rejects javascript: scheme", () => {
    expect(validateRedirectUrl("javascript:alert(1)").ok).toBe(false);
  });

  it("rejects protocol-relative //host URLs", () => {
    // `<a href="//evil.example">` would resolve to https://evil.example
    // when the page is on HTTPS. Explicitly reject to keep the
    // "same-origin path" branch tight.
    expect(validateRedirectUrl("//evil.example/x").ok).toBe(false);
  });
});

describe("getCallbackAllowedHosts", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns undefined when the env is unset", () => {
    delete process.env.PLANNER_CALLBACK_ALLOWED_HOSTS;
    expect(getCallbackAllowedHosts()).toBeUndefined();
  });

  it("splits, trims, and filters empty entries", () => {
    vi.stubEnv("PLANNER_CALLBACK_ALLOWED_HOSTS", "a.test ,  b.test,, c.test ");
    expect(getCallbackAllowedHosts()).toEqual(["a.test", "b.test", "c.test"]);
  });
});
