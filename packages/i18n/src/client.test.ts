/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { i18n, initI18nClient } from "./index.ts";

describe("initI18nClient", () => {
  it("normalizes regional html lang tags to supported languages", () => {
    document.documentElement.lang = "de-DE";

    initI18nClient();

    expect(i18n.language).toBe("de");
    expect(i18n.t("journal:nav.login")).toBe("Anmelden");
  });
});
