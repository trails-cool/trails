import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

export default function LoginPage() {
  const { t } = useTranslation("journal");
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [supportsPasskey, setSupportsPasskey] = useState(true);
  const [mode, setMode] = useState<"passkey" | "magic-link">("passkey");

  useEffect(() => {
    import("@simplewebauthn/browser").then(({ browserSupportsWebAuthn }) => {
      const supported = browserSupportsWebAuthn();
      setSupportsPasskey(supported);
      if (!supported) setMode("magic-link");
    });
  }, []);
  const [email, setEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handlePasskeyLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const startResp = await fetch("/api/auth/login", {
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

      const finishResp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "finish-passkey",
          response: webAuthnResp,
          challenge: startData.options.challenge,
        }),
      });

      const finishData = await finishResp.json();
      if (finishData.error) {
        setError(finishData.error);
      } else if (finishData.step === "done") {
        window.location.href = returnTo ?? "/";
      }
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("timed out") || message.includes("not allowed")) {
        setError("No passkey found for this site. Register a new account or use a magic link instead.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "verify-code", email, code: loginCode }),
      });
      const result = await resp.json();

      if (result.error) {
        setError(result.error);
      } else if (result.step === "done") {
        window.location.href = returnTo ?? "/";
      }
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
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "magic-link", email }),
      });
      const result = await resp.json();

      if (result.error) {
        setError(result.error);
      } else if (result.devLink) {
        // Dev mode: auto-redirect to magic link
        const devUrl = returnTo
          ? `${result.devLink}&returnTo=${encodeURIComponent(returnTo)}`
          : result.devLink;
        window.location.href = devUrl;
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
      <h1 className="text-2xl font-bold text-gray-900">{t("auth.login")}</h1>

      {mode === "passkey" && supportsPasskey && (
        <div className="mt-8">
          <button
            onClick={handlePasskeyLogin}
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t("auth.authenticating") : t("auth.signInWithPasskey")}
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => setMode("magic-link")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t("auth.useMagicLink")}
            </button>
          </div>
        </div>
      )}

      {mode === "magic-link" && !magicLinkSent && (
        <form onSubmit={handleMagicLink} className="mt-8 space-y-4">
          <p className="text-sm text-gray-600">
            {t("auth.magicLinkHelp")}
          </p>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t("auth.email")}
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
            {loading ? t("auth.sending") : t("auth.sendMagicLink")}
          </button>

          {supportsPasskey && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode("passkey")}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {t("auth.backToPasskey")}
              </button>
            </div>
          )}
        </form>
      )}

      {magicLinkSent && (
        <div className="mt-8 space-y-4">
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">
              {t("auth.checkEmail")} <strong>{email}</strong>.
            </p>
            <p className="mt-2 text-xs text-green-600">
              {t("auth.linkExpires")}
            </p>
          </div>

          <form onSubmit={handleCodeVerify} className="space-y-3">
            <p className="text-sm text-gray-600">{t("auth.codeHelp")}</p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="block w-full rounded-md border border-gray-300 px-3 py-3 text-center text-2xl font-mono tracking-[0.3em] shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading || loginCode.length !== 6}
              className="w-full rounded-md bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {loading ? t("auth.authenticating") : t("auth.verifyCode")}
            </button>
          </form>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}

      <p className="mt-6 text-center text-sm text-gray-500">
        {t("auth.noAccount")}{" "}
        <a href="/auth/register" className="text-blue-600 hover:underline">
          {t("auth.register")}
        </a>
      </p>
    </div>
  );
}
