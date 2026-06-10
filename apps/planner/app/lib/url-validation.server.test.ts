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

describe("validateFetchUrl — private-address blocking (production)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    // Production-without-E2E is the only mode that blocks (mirrors the
    // requireSecret guard). Tests otherwise run as NODE_ENV=test → off.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E", "");
  });

  const blocked = [
    "http://127.0.0.1/x",
    "http://localhost:3000/x",
    "http://sub.localhost/x",
    "http://169.254.169.254/latest/meta-data/", // cloud metadata
    "http://10.0.0.5/x",
    "http://172.16.0.1/x",
    "http://172.31.255.254/x",
    "http://192.168.1.1/x",
    "http://100.64.0.1/x", // CGNAT
    "http://0.0.0.0/x",
    "http://[::1]/x",
    "http://[fc00::1]/x",
    "http://[fe80::1]/x",
    "http://[::ffff:127.0.0.1]/x",
  ];
  for (const url of blocked) {
    it(`blocks ${url}`, () => {
      expect(validateFetchUrl(url).ok).toBe(false);
    });
  }

  it("still allows public hosts", () => {
    expect(validateFetchUrl("https://journal.trails.cool/api/cb").ok).toBe(true);
    expect(validateFetchUrl("http://203.0.113.10/x").ok).toBe(true); // public IP literal
    expect(validateFetchUrl("http://172.15.0.1/x").ok).toBe(true); // just outside RFC1918 /12
    expect(validateFetchUrl("http://172.32.0.1/x").ok).toBe(true);
  });

  it("an explicit allowlist overrides private blocking (operator decision)", () => {
    expect(
      validateFetchUrl("http://10.0.0.2:3000/cb", { allowedHosts: ["10.0.0.2:3000"] }).ok,
    ).toBe(true);
  });

  it("does not block private hosts outside production (dev/e2e localhost flow)", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(validateFetchUrl("http://localhost:3000/cb").ok).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E", "true");
    expect(validateFetchUrl("http://localhost:3000/cb").ok).toBe(true);
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
