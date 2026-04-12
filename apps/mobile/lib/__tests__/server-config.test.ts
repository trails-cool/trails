import { isApiVersionCompatible } from "../server-config";

describe("isApiVersionCompatible", () => {
  it("compatible when major versions match", () => {
    expect(isApiVersionCompatible("1.0.0")).toBe(true);
    expect(isApiVersionCompatible("1.2.3")).toBe(true);
    expect(isApiVersionCompatible("1.99.0")).toBe(true);
  });

  it("incompatible when major versions differ", () => {
    expect(isApiVersionCompatible("2.0.0")).toBe(false);
    expect(isApiVersionCompatible("0.9.0")).toBe(false);
  });

  it("handles malformed versions gracefully", () => {
    expect(isApiVersionCompatible("")).toBe(false);
    expect(isApiVersionCompatible("abc")).toBe(false);
  });
});
