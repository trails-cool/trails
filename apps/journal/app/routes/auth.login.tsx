import { useState } from "react";
import { data, redirect } from "react-router";
import type { Route } from "./+types/auth.login";
import { startAuthentication, finishAuthentication, createMagicToken, createSession } from "~/lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.json();
  const { step, response, challenge, email } = formData;

  try {
    if (step === "start-passkey") {
      const options = await startAuthentication();
      return data({ step: "challenge", options });
    }

    if (step === "finish-passkey") {
      const userId = await finishAuthentication(response, challenge);
      const cookie = await createSession(userId, request);
      return redirect("/", { headers: { "Set-Cookie": cookie } });
    }

    if (step === "magic-link") {
      const token = await createMagicToken(email);
      // In production, send email. For dev, log the link.
      const link = `${process.env.ORIGIN ?? "http://localhost:3000"}/auth/verify?token=${token}`;
      console.log(`[Magic Link] ${email}: ${link}`);
      return data({ step: "magic-link-sent" });
    }

    return data({ error: "Invalid step" }, { status: 400 });
  } catch (e) {
    return data({ error: (e as Error).message }, { status: 400 });
  }
}

export default function LoginPage() {
  const [mode, setMode] = useState<"passkey" | "magic-link">("passkey");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handlePasskeyLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const startResp = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "start-passkey" }),
      });
      const startData = await startResp.json();

      if (startData.error) {
        setError(startData.error);
        setLoading(false);
        return;
      }

      const { startAuthentication: startWebAuthn } = await import("@simplewebauthn/browser");
      const webAuthnResp = await startWebAuthn(startData.options);

      const finishResp = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "finish-passkey",
          response: webAuthnResp,
          challenge: startData.options.challenge,
        }),
      });

      if (finishResp.redirected) {
        window.location.href = finishResp.url;
        return;
      }

      const finishData = await finishResp.json();
      if (finishData.error) setError(finishData.error);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const resp = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "magic-link", email }),
      });
      const result = await resp.json();

      if (result.error) {
        setError(result.error);
      } else {
        setMagicLinkSent(true);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>

      {mode === "passkey" && (
        <div className="mt-8">
          <button
            onClick={handlePasskeyLogin}
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign in with Passkey"}
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => setMode("magic-link")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              No passkey on this device? Use a magic link instead
            </button>
          </div>
        </div>
      )}

      {mode === "magic-link" && !magicLinkSent && (
        <form onSubmit={handleMagicLink} className="mt-8 space-y-4">
          <p className="text-sm text-gray-600">
            We'll send a login link to your email.
          </p>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Magic Link"}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode("passkey")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back to passkey login
            </button>
          </div>
        </form>
      )}

      {magicLinkSent && (
        <div className="mt-8 rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">
            Check your email! We sent a login link to <strong>{email}</strong>.
          </p>
          <p className="mt-2 text-xs text-green-600">
            The link expires in 15 minutes.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}

      <p className="mt-6 text-center text-sm text-gray-500">
        Don't have an account?{" "}
        <a href="/auth/register" className="text-blue-600 hover:underline">
          Register
        </a>
      </p>
    </div>
  );
}
