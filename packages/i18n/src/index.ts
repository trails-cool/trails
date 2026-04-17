import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.ts";
import de from "./locales/de.ts";

export const defaultNS = "common";

export const supportedLngs = ["en", "de"] as const;
export type SupportedLng = (typeof supportedLngs)[number];

export const resources = {
  en: { common: en.common, planner: en.planner, journal: en.journal, mobile: en.mobile },
  de: { common: de.common, planner: de.planner, journal: de.journal, mobile: de.mobile },
} as const;

const commonOptions = {
  resources,
  defaultNS,
  fallbackLng: "en" as const,
  supportedLngs: [...supportedLngs],
  interpolation: { escapeValue: false },
  initAsync: false,
};

/**
 * Initialize i18next for server-side rendering.
 * No language detector — language is determined from the request.
 *
 * Re-adds resource bundles on every call so dev-mode HMR edits to the
 * locale files are reflected without a Node restart (the i18n singleton
 * otherwise caches the resources from the first init call).
 */
export function initI18nServer(lng: SupportedLng = "en") {
  if (i18n.isInitialized) {
    syncResources();
    i18n.changeLanguage(lng);
    return;
  }
  i18n.use(initReactI18next).init({ ...commonOptions, lng });
}

function syncResources() {
  for (const [lang, namespaces] of Object.entries(resources)) {
    for (const [ns, bundle] of Object.entries(namespaces)) {
      i18n.addResourceBundle(lang, ns, bundle, true, true);
    }
  }
}

/**
 * Initialize i18next for the client.
 * Uses LanguageDetector with htmlTag priority so hydration matches the server.
 * No localStorage caching — we don't want to set non-essential storage
 * without user consent. Language is resolved per-request from the server
 * (Accept-Language → htmlTag) or the browser's navigator as a fallback.
 */
export function initI18nClient() {
  if (i18n.isInitialized) return;
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      ...commonOptions,
      detection: {
        order: ["htmlTag", "navigator"],
        caches: [],
      },
    });
}

/**
 * Initialize i18next for React Native.
 * No browser language detector — pass the device locale directly.
 * Use `expo-localization` to get the device locale:
 *
 * ```ts
 * import { getLocales } from "expo-localization";
 * initI18nMobile(getLocales()[0]?.languageCode ?? "en");
 * ```
 */
export function initI18nMobile(deviceLanguage?: string) {
  if (i18n.isInitialized) return;
  const lng = matchSupportedLng(deviceLanguage);
  i18n.use(initReactI18next).init({ ...commonOptions, lng });
}

function matchSupportedLng(lang?: string): SupportedLng {
  if (!lang) return "en";
  const lower = lang.toLowerCase();
  for (const supported of supportedLngs) {
    if (lower === supported || lower.startsWith(supported + "-")) {
      return supported;
    }
  }
  return "en";
}

/**
 * Detect the best supported language from a request's Accept-Language header.
 */
export function detectLanguage(request: Request): SupportedLng {
  const header = request.headers.get("Accept-Language") ?? "";
  for (const part of header.split(",")) {
    const lang = part.split(";")[0]?.trim().toLowerCase();
    if (!lang) continue;
    for (const supported of supportedLngs) {
      if (lang === supported || lang.startsWith(supported + "-")) {
        return supported;
      }
    }
  }
  return "en";
}

/**
 * Extract the full locale (e.g. "de-DE") from a request's Accept-Language header.
 * Falls back to the supported language (e.g. "en") if no region tag is present.
 */
export function detectLocale(request: Request): string {
  const header = request.headers.get("Accept-Language") ?? "";
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim();
    if (!tag) continue;
    const lang = tag.toLowerCase();
    for (const supported of supportedLngs) {
      if (lang === supported || lang.startsWith(supported + "-")) {
        return tag; // preserve original casing (e.g. "de-DE")
      }
    }
  }
  return "en";
}

export { i18n };
