import { useTranslation } from "react-i18next";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "trails.cool Planner — Collaborative Route Planning" },
    { name: "description", content: "Plan hiking and cycling routes together in real-time. No account needed." },
  ];
}

const features = [
  { key: "featureCollaborative", icon: "👥" },
  { key: "featureRouting", icon: "🗺️" },
  { key: "featureElevation", icon: "⛰️" },
  { key: "featureExport", icon: "📥" },
  { key: "featureNoAccount", icon: "🔓" },
] as const;

export default function Home() {
  const { t } = useTranslation("planner");

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-lg text-center text-lg text-gray-600">
          {t("landing.heroDescription")}
        </p>
        <a
          href="/new"
          className="mt-8 rounded-lg bg-blue-600 px-8 py-3 text-lg font-medium text-white shadow-sm hover:bg-blue-700"
        >
          {t("landing.startPlanning")}
        </a>
      </section>

      {/* Features */}
      <section className="border-t border-gray-200 bg-gray-50 px-4 py-16">
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ key, icon }) => (
            <div key={key} className="rounded-lg bg-white p-6 shadow-sm">
              <div className="text-3xl">{icon}</div>
              <h3 className="mt-3 font-semibold text-gray-900">
                {t(`landing.${key}`)}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {t(`landing.${key}Desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Secondary CTA */}
      <section className="border-t border-gray-200 px-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900">
          {t("landing.saveRoutes")}
        </h2>
        <p className="mt-2 text-gray-600">
          {t("landing.saveRoutesDesc")}
        </p>
        <a
          href="https://trails.cool"
          className="mt-4 inline-block rounded-md border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
        >
          {t("landing.goToJournal")}
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-4 py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 text-sm text-gray-400">
          <span>{t("landing.footer.builtWith")}</span>
          <div className="flex gap-4">
            <a href="https://trails.cool/privacy" className="hover:text-gray-600">
              {t("landing.footer.privacy")}
            </a>
            <a href="https://github.com/trails-cool/trails" className="hover:text-gray-600">
              {t("landing.footer.source")}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
