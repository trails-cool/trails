/**
 * @vitest-environment node
 *
 * Tests run in node environment (no browser APIs) to verify
 * React Native compatibility of initI18nMobile.
 */
import { describe, it, expect } from "vitest";
import { initI18nMobile, i18n, supportedLngs, resources } from "./index.ts";

describe("initI18nMobile", () => {
  it("initializes i18next without browser APIs", () => {
    // Verify no browser globals exist in this environment
    expect(typeof document).toBe("undefined");
    expect(typeof localStorage).toBe("undefined");

    initI18nMobile("de-AT");
    expect(i18n.isInitialized).toBe(true);
    // Regional variant should match supported "de"
    expect(i18n.language).toBe("de");
  });

  it("has all translation namespaces loaded", () => {
    expect(i18n.hasResourceBundle("en", "common")).toBe(true);
    expect(i18n.hasResourceBundle("de", "common")).toBe(true);
    expect(i18n.hasResourceBundle("en", "planner")).toBe(true);
    expect(i18n.hasResourceBundle("de", "journal")).toBe(true);
  });

  it("can switch language after init", () => {
    i18n.changeLanguage("en");
    expect(i18n.language).toBe("en");
  });

  it("exports supported languages and resources", () => {
    expect(supportedLngs).toContain("en");
    expect(supportedLngs).toContain("de");
    expect(resources.en.common).toBeDefined();
    expect(resources.de.common).toBeDefined();
  });
});
