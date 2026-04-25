import { useTranslation } from "react-i18next";

interface Entry {
  username: string;
  displayName: string | null;
  domain: string;
}

interface Props {
  kind: "followers" | "following";
  user: { username: string; displayName: string | null };
  entries: Entry[];
  page: number;
  total: number;
}

const PAGE_SIZE = 50;

export function CollectionPage({ kind, user, entries, page, total }: Props) {
  const { t } = useTranslation("journal");
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const heading = t(`social.${kind}.heading`, {
    user: user.displayName ?? user.username,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <nav className="mb-4 text-sm text-gray-500">
        <a href={`/users/${user.username}`} className="hover:text-gray-700 hover:underline">
          @{user.username}
        </a>
        {" / "}
        <span>{kind === "followers" ? t("social.followers.label") : t("social.following.label")}</span>
      </nav>
      <h1 className="text-2xl font-bold text-gray-900">{heading}</h1>
      <p className="mt-1 text-sm text-gray-500">{t(`social.${kind}.count`, { count: total })}</p>

      {entries.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">
          {t(`social.${kind}.empty`)}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {entries.map((entry) => (
            <li key={entry.username} className="px-4 py-3">
              <a
                href={`/users/${entry.username}`}
                className="flex items-center justify-between hover:underline"
              >
                <span className="text-sm font-medium text-gray-900">
                  {entry.displayName ?? entry.username}
                </span>
                <span className="text-xs text-gray-500">@{entry.username}@{entry.domain}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <a
              href={`?page=${page - 1}`}
              className="text-blue-600 hover:underline"
            >
              ← {t("social.prevPage")}
            </a>
          ) : <span />}
          <span className="text-gray-500">
            {t("social.pageOfTotal", { page, totalPages })}
          </span>
          {page < totalPages ? (
            <a
              href={`?page=${page + 1}`}
              className="text-blue-600 hover:underline"
            >
              {t("social.nextPage")} →
            </a>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
