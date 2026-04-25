import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TERMS_VERSION } from "~/lib/legal";

export default function RegisterPage() {
  const { t } = useTranslation("journal");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [supportsPasskey, setSupportsPasskey] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"passkey" | "magic-link">("passkey");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [hostname, setHostname] = useState("…");

  useEffect(() => {
    setHostname(window.location.hostname);
    import("@simplewebauthn/browser").then(({ browserSupportsWebAuthn }) => {
      const supported = browserSupportsWebAuthn();
      setSupportsPasskey(supported);
      if (!supported) setMode("magic-link");
    });
  }, []);

  const handleRegisterPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError(t("auth.termsRequired"));
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const startResp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "start",
          email,
          username,
          termsAccepted,
          termsVersion: TERMS_VERSION,
        }),
      });
      const startData = await startResp.json();

      if (startData.error) {
        setError(startData.error);
        setLoading(false);
        return;
      }

      const { startRegistration: startWebAuthn } = await import("@simplewebauthn/browser");
      const webAuthnResp = await startWebAuthn(startData.options);

      const finishResp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "finish",
          email,
          username,
          termsAccepted,
          termsVersion: TERMS_VERSION,
          response: webAuthnResp,
          challenge: startData.options.challenge,
          userId: startData.userId,
        }),
      });

      const finishData = await finishResp.json();
      if (finishData.error) {
        setError(finishData.error);
      } else if (finishData.step === "done") {
        window.location.href = "/";
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError(t("auth.termsRequired"));
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "register-magic-link",
          email,
          username,
          termsAccepted,
          termsVersion: TERMS_VERSION,
        }),
      });
      const result = await resp.json();

      if (result.error) {
        setError(result.error);
      } else {
        // In dev the API also returns the link/code; we still show the
        // code form so the dev can paste either, matching production
        // behavior. Devs can copy `devLink` from the server log if they
        // want the click-through path instead.
        setMagicLinkSent(true);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // The token row created by `register-magic-link` has the default
      // `purpose: "login"`, so the existing login verify-code endpoint
      // accepts it without a separate register-only verify path.
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "verify-code", email, code: verifyCode }),
      });
      const result = await resp.json();
      if (result.error) {
        setError(result.error);
      } else if (result.step === "done") {
        window.location.href = "/?add-passkey=1";
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-bold text-gray-900">{t("auth.register")}</h1>
        <div className="mt-8 space-y-4">
          <div className="rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">
              {t("auth.checkEmail")} <strong>{email}</strong>.
            </p>
            <p className="mt-2 text-xs text-green-600">
              {t("auth.linkExpires")}
            </p>
          </div>

          <form onSubmit={handleVerifyCode} className="space-y-3">
            <p className="text-sm text-gray-600">{t("auth.codeHelp")}</p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="block w-full rounded-md border border-gray-300 px-3 py-3 text-center text-2xl font-mono tracking-[0.3em] shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading || verifyCode.length !== 6}
              className="w-full rounded-md bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {loading ? t("auth.authenticating") : t("auth.verifyCode")}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">{t("auth.register")}</h1>
      <p className="mt-2 text-sm text-gray-600">
        {t("auth.registerDescription")}
      </p>

      <form onSubmit={mode === "passkey" && supportsPasskey ? handleRegisterPasskey : handleRegisterMagicLink} className="mt-8 space-y-4">
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

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700">
            {t("auth.username")}
          </label>
          <input
            id="username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="alice"
          />
          <p className="mt-1 text-xs text-gray-500">
            {t("auth.handleWillBe", {
              handle: `@${username || "…"}@${hostname}`,
            })}
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
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

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {mode === "passkey" && supportsPasskey ? (
          <button
            type="submit"
            disabled={loading || !termsAccepted}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t("auth.creatingPasskey") : t("auth.registerWithPasskey")}
          </button>
        ) : (
          <button
            type="submit"
            disabled={loading || supportsPasskey === null || !termsAccepted}
            className="w-full rounded-md bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 disabled:opacity-50"
          >
            {loading ? t("auth.sending") : t("auth.registerWithMagicLink")}
          </button>
        )}

        {supportsPasskey && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode(mode === "passkey" ? "magic-link" : "passkey")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {mode === "passkey" ? t("auth.useMagicLink") : t("auth.backToPasskey")}
            </button>
          </div>
        )}

        {supportsPasskey === false && (
          <p className="text-sm text-gray-500">
            {t("auth.passkeyNotSupportedRegister")}
          </p>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        {t("auth.alreadyHaveAccount")}{" "}
        <a href="/auth/login" className="text-blue-600 hover:underline">
          {t("auth.login")}
        </a>
      </p>
    </div>
  );
}
