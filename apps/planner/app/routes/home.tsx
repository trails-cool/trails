import { useTranslation } from "react-i18next";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "trails.cool Planner" },
    { name: "description", content: "Collaborative route planning" },
  ];
}

export default function Home() {
  const { t } = useTranslation("planner");

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-4 text-lg text-gray-600">{t("subtitle")}</p>
      </div>
    </div>
  );
}
