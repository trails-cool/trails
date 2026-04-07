import { data } from "react-router";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import type { Route } from "./+types/changelog.$slug";
import { getEntry } from "~/lib/changelog.server";
import { ClientDate } from "~/components/ClientDate";

export function meta({ data: entry }: Route.MetaArgs) {
  if (!entry) return [{ title: "Not Found — trails.cool" }];
  return [
    { title: `${entry.title} — Changelog — trails.cool` },
    { name: "description", content: entry.preview },
    { property: "og:title", content: entry.title },
    { property: "og:description", content: entry.preview },
    { property: "og:url", content: `https://trails.cool/changelog/${entry.slug}` },
  ];
}

export function links() {
  return [
    { rel: "alternate", type: "application/atom+xml", title: "trails.cool Changelog", href: "/changelog/feed.xml" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const entry = getEntry(params.slug);
  if (!entry) throw data(null, { status: 404 });
  return entry;
}

export default function ChangelogEntryPage({ loaderData: entry }: Route.ComponentProps) {
  const { t } = useTranslation("journal");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <a href="/changelog" className="text-sm text-blue-600 hover:underline">
        {t("changelog.backToList")}
      </a>
      <article className="mt-4">
        <time className="text-sm text-gray-500">
          <ClientDate iso={entry.date} />
        </time>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">{entry.title}</h1>
        <div className="prose prose-gray mt-6 max-w-none">
          <Markdown>{entry.content}</Markdown>
        </div>
      </article>
    </div>
  );
}
