import { data } from "react-router";
import type { Route } from "./+types/home";
import { getSessionUser } from "~/lib/auth.server";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "trails.cool" },
    { name: "description", content: "Your outdoor activity journal" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  return data({ user: user ? { username: user.username, displayName: user.displayName } : null });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-4xl font-bold text-gray-900">trails.cool</h1>
      <p className="mt-4 text-lg text-gray-600">Your outdoor activity journal</p>

      {user ? (
        <div className="mt-8">
          <p className="text-gray-700">
            Welcome, <a href={`/users/${user.username}`} className="text-blue-600 hover:underline">{user.displayName ?? user.username}</a>
          </p>
        </div>
      ) : (
        <div className="mt-8 flex gap-4">
          <a
            href="/auth/register"
            className="rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Register
          </a>
          <a
            href="/auth/login"
            className="rounded-md border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
          >
            Sign in
          </a>
        </div>
      )}
    </div>
  );
}
