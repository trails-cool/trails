import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/changelog._index";
import { getAllEntries, getNewestDate } from "~/lib/changelog.server";
import { ClientDate } from "~/components/ClientDate";
import { ChangelogNotificationToggle } from "~/components/ChangelogIndicator";

export function meta() {
  return [
    { title: "Changelog — trails.cool" },
    { name: "description", content: "What's new on trails.cool" },
    { property: "og:title", content: "Changelog — trails.cool" },
    { property: "og:description", content: "What's new on trails.cool" },
  ];
}

export function links() {
  return [
    { rel: "alternate", type: "application/atom+xml", title: "trails.cool Changelog", href: "/changelog/feed.xml" },
  ];
}

export async function loader() {
  return { entries: getAllEntries(), newestDate: getNewestDate() };
}

export default function ChangelogListPage({ loaderData }: Route.ComponentProps) {
  const { entries } = loaderData;
  const { t } = useTranslation("journal");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("changelog.title")}</h1>
          <p className="mt-1 text-gray-500">{t("changelog.subtitle")}</p>
        </div>
        <ChangelogNotificationToggle />
      </div>

      <div className="mt-8 space-y-6">
        {entries.map((entry) => (
          <Link
            key={entry.slug}
            to={`/changelog/${entry.slug}`}
            className="block rounded-lg border border-gray-200 bg-white p-6 transition hover:border-blue-300 hover:shadow-sm"
          >
            <time className="text-sm text-gray-500">
              <ClientDate iso={entry.date} />
            </time>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">{entry.title}</h2>
            <p className="mt-2 text-gray-600">{entry.preview}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
