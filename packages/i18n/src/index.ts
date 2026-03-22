import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en";
import de from "./locales/de";

export const defaultNS = "common";

export const resources = {
  en: { common: en.common, planner: en.planner, journal: en.journal },
  de: { common: de.common, planner: de.planner, journal: de.journal },
} as const;

export function initI18n() {
  return i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      defaultNS,
      fallbackLng: "en",
      supportedLngs: ["en", "de"],
      interpolation: {
        escapeValue: false,
      },
    });
}

export { i18n };
