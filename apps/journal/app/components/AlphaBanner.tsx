import { useTranslation } from "react-i18next";

export function AlphaBanner() {
  const { t } = useTranslation("journal");
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-900">
      <p>{t("alpha.message")}</p>
    </div>
  );
}
