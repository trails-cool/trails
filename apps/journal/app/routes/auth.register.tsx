import { useState } from "react";
import { data, redirect } from "react-router";
import type { Route } from "./+types/auth.register";
import { startRegistration, finishRegistration, createSession } from "~/lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.json();
  const { step, email, username, response, challenge, userId } = formData;

  try {
    if (step === "start") {
      const { options, userId } = await startRegistration(email, username);
      return data({ step: "challenge", options, userId });
    }

    if (step === "finish") {
      const newUserId = await finishRegistration(userId, email, username, response, challenge);
      const cookie = await createSession(newUserId, request);
      return redirect("/", { headers: { "Set-Cookie": cookie } });
    }

    return data({ error: "Invalid step" }, { status: 400 });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 400 });
  }
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Step 1: Get registration options from server
      const startResp = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "start", email, username }),
      });
      const startData = await startResp.json();

      if (startData.error) {
        setError(startData.error);
        setLoading(false);
        return;
      }

      // Step 2: Create passkey via browser
      const { startRegistration: startWebAuthn } = await import("@simplewebauthn/browser");
      const webAuthnResp = await startWebAuthn(startData.options);

      // Step 3: Send response to server
      const finishResp = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "finish",
          email,
          username,
          response: webAuthnResp,
          challenge: startData.options.challenge,
          userId: startData.userId,
        }),
      });

      if (finishResp.redirected) {
        window.location.href = finishResp.url;
        return;
      }

      const finishData = await finishResp.json();
      if (finishData.error) {
        setError(finishData.error);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
      <p className="mt-2 text-sm text-gray-600">
        Register with a passkey — no password needed.
      </p>

      <form onSubmit={handleRegister} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            id="username"
            type="text"
            required
            pattern="[a-z0-9_-]+"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="alice"
          />
          <p className="mt-1 text-xs text-gray-500">
            Your handle will be @{username || "..."}@{typeof window !== "undefined" ? window.location.hostname : "trails.cool"}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating passkey..." : "Register with Passkey"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <a href="/auth/login" className="text-blue-600 hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
