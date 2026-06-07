import { data, redirect, Form, useNavigation } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/follows.outgoing";
import { getSessionUser } from "~/lib/auth/session.server";
import { FollowError } from "~/lib/follow.server";
import {
  followRemoteActor,
  cancelRemoteFollow,
  listOutgoingRemoteFollows,
} from "~/lib/federation-outbound.server";
import { federationEnabled } from "~/lib/federation.server";
import { ClientDate } from "~/components/ClientDate";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (!user) return redirect("/auth/login");
  const entries = await listOutgoingRemoteFollows(user.id);
  return data({ entries, federationEnabled: federationEnabled() });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getSessionUser(request);
  if (!user) return data({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const intent = form.get("intent");
  try {
    if (intent === "follow") {
      const handle = String(form.get("handle") ?? "");
      const state = await followRemoteActor(user.id, handle);
      return data({ ok: true, ...state });
    }
    if (intent === "cancel") {
      const actorIri = String(form.get("actorIri") ?? "");
      await cancelRemoteFollow(user.id, actorIri);
      return data({ ok: true });
    }
    return data({ error: "Unknown intent" }, { status: 400 });
  } catch (e) {
    if (e instanceof FollowError) {
      return data({ error: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }
}

export function meta() {
  return [{ title: "Following across instances — trails.cool" }];
}

export default function OutgoingFollows({ loaderData, actionData }: Route.ComponentProps) {
  const { entries, federationEnabled } = loaderData;
  const { t } = useTranslation("journal");
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const error = actionData && "error" in actionData ? actionData.error : null;
  const errorCode = actionData && "code" in actionData ? (actionData.code as string) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">{t("social.outgoing.heading")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("social.outgoing.subtitle")}</p>

      {!federationEnabled ? (
        <p className="mt-8 rounded-md bg-gray-50 p-4 text-sm text-gray-600">
          {t("social.outgoing.disabled")}
        </p>
      ) : (
        <>
          <Form method="post" className="mt-6 flex items-end gap-3">
            <input type="hidden" name="intent" value="follow" />
            <div className="flex-1">
              <label htmlFor="handle" className="block text-sm font-medium text-gray-700">
                {t("social.outgoing.handleLabel")}
              </label>
              <input
                id="handle"
                name="handle"
                type="text"
                placeholder="@alice@other-trails.example"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {t("social.outgoing.followButton")}
            </button>
          </Form>
          {error && (
            <p className="mt-2 text-sm text-red-600">
              {errorCode === "not_trails" ? t("social.outgoing.notTrails") : error}
            </p>
          )}

          {entries.length === 0 ? (
            <p className="mt-10 text-center text-gray-500">{t("social.outgoing.empty")}</p>
          ) : (
            <ul className="mt-8 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
              {entries.map((e) => (
                <li key={e.actorIri} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <a
                      href={e.actorIri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 hover:underline"
                    >
                      {e.displayName ?? e.username ?? e.actorIri}
                    </a>
                    <p className="text-xs text-gray-500">
                      {e.username && e.domain ? `@${e.username}@${e.domain}` : e.actorIri}
                      {" · "}
                      {e.pending ? (
                        <span className="text-amber-600">{t("social.outgoing.pendingBadge")}</span>
                      ) : (
                        <span className="text-green-700">{t("social.outgoing.acceptedBadge")}</span>
                      )}
                      {" · "}
                      <ClientDate iso={e.createdAt as unknown as string} />
                    </p>
                  </div>
                  <Form method="post">
                    <input type="hidden" name="intent" value="cancel" />
                    <input type="hidden" name="actorIri" value={e.actorIri} />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {e.pending ? t("social.outgoing.cancelRequest") : t("social.outgoing.unfollow")}
                    </button>
                  </Form>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
