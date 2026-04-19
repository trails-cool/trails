import { useState } from "react";
import { Form, data, redirect, useLoaderData, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/auth.accept-terms";
import { getSessionUser, recordTermsAcceptance } from "~/lib/auth.server";
import { TERMS_VERSION } from "~/lib/legal";

export function meta() {
  return [
    { title: "Updated Terms of Service — trails.cool" },
    { name: "robots", content: "noindex" },
  ];
}

/**
 * Paths we'll bounce back to after a successful acceptance. We only allow
 * same-origin absolute paths to avoid being used as an open redirect.
 */
function safeReturnTo(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) {
    throw redirect("/auth/login");
  }
  // If the user is already current, bounce them back (e.g. double-submit).
  if (user.termsVersion === TERMS_VERSION) {
    const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
    throw redirect(returnTo);
  }
  return { previousVersion: user.termsVersion };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) {
    throw redirect("/auth/login");
  }

  const form = await request.formData();
  const accepted = form.get("termsAccepted") === "on" || form.get("termsAccepted") === "true";
  if (!accepted) {
    return data({ error: "Terms of Service must be accepted to continue" }, { status: 400 });
  }

  await recordTermsAcceptance(user.id, TERMS_VERSION);

  const returnTo = safeReturnTo(form.get("returnTo")?.toString() ?? null);
  throw redirect(returnTo);
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
