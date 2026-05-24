import type { Route } from "./+types/auth.verify";
import { loadAuthVerify } from "./auth.verify.server";

export async function loader({ request }: Route.LoaderArgs) {
  return await loadAuthVerify(request);
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
