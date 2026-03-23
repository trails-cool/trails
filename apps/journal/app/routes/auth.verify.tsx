import { redirect, data } from "react-router";
import type { Route } from "./+types/auth.verify";
import { verifyMagicToken, createSession } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return data({ error: "Missing token" }, { status: 400 });
  }

  try {
    const userId = await verifyMagicToken(token);
    const cookie = await createSession(userId, request);
    // Redirect to home with prompt to add passkey
    return redirect("/?add-passkey=1", { headers: { "Set-Cookie": cookie } });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 400 });
  }
}

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-red-600">Invalid or expired magic link.</p>
      <a href="/auth/login" className="mt-4 inline-block text-blue-600 hover:underline">
        Request a new one
      </a>
    </div>
  );
}
