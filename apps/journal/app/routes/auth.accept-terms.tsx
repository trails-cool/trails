import { useState } from "react";
import { Form, useLoaderData, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/auth.accept-terms";
import { TERMS_VERSION } from "~/lib/legal";
import { loadAcceptTerms, acceptTermsAction } from "./auth.accept-terms.server";

export function meta() {
  return [
    { title: "Updated Terms of Service — trails.cool" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  return await loadAcceptTerms(request);
}

export async function action({ request }: Route.ActionArgs) {
  return await acceptTermsAction(request);
}

export default function AcceptTermsPage() {
  const { t } = useTranslation("journal");
  const { previousVersion } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">
        {t("auth.reaccept.heading")}
      </h1>
      <p className="mt-4 text-sm text-gray-700">
        {previousVersion
          ? t("auth.reaccept.bodyUpdated", { from: previousVersion, to: TERMS_VERSION })
          : t("auth.reaccept.bodyNew", { version: TERMS_VERSION })}
      </p>

      <Form method="post" className="mt-8 space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="termsAccepted"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {t("auth.termsBefore")}
            <a
              href="/legal/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {t("auth.termsLink")}
            </a>
            {t("auth.termsAfter")}
          </span>
        </label>

        <button
          type="submit"
          disabled={!accepted}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {t("auth.reaccept.submit")}
        </button>
      </Form>

      <Form method="post" action="/auth/logout" className="mt-6 text-center">
        <button
          type="submit"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {t("auth.reaccept.logoutInstead")}
        </button>
      </Form>
    </div>
  );
}
