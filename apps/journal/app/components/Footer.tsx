import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation("journal");
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-gray-500">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a href="/legal/imprint" className="hover:text-gray-700">
            {t("footer.imprint")}
          </a>
          <a href="/legal/privacy" className="hover:text-gray-700">
            {t("footer.privacy")}
          </a>
          <a href="/legal/terms" className="hover:text-gray-700">
            {t("footer.terms")}
          </a>
          <a
            href="https://github.com/trails-cool/trails"
            className="hover:text-gray-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("footer.source")}
          </a>
          <span className="ml-auto text-xs text-gray-400">
            {t("footer.alpha")}
          </span>
        </div>
      </div>
    </footer>
  );
}
