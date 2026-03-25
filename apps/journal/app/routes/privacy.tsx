import type { Route } from "./+types/privacy";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Privacy — trails.cool" }];
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Privacy Manifest</h1>
      <p className="mt-4 text-gray-600">
        trails.cool is committed to privacy by design. This manifest documents
        everything we collect, why, and how you can control it.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Planner (planner.trails.cool)</h2>
        <p className="mt-2 text-gray-600">
          The Planner collects <strong>no personal data</strong>. Sessions are anonymous —
          there are no user accounts, no tracking, and no analytics on your routes.
        </p>
        <ul className="mt-3 list-disc pl-6 text-gray-600 space-y-1">
          <li>No cookies (except ephemeral session state)</li>
          <li>No user accounts or login</li>
          <li>No route data is stored permanently without your action</li>
          <li>Session data is automatically deleted after 7 days of inactivity</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Journal (trails.cool)</h2>
        <p className="mt-2 text-gray-600">
          The Journal stores the data you explicitly provide:
        </p>
        <ul className="mt-3 list-disc pl-6 text-gray-600 space-y-1">
          <li><strong>Account data</strong>: email, username, display name, passkey credentials</li>
          <li><strong>Routes</strong>: name, description, GPX data, geometry</li>
          <li><strong>Activities</strong>: title, description, date, linked routes</li>
        </ul>
        <p className="mt-3 text-gray-600">
          All your data is exportable at any time in open formats (GPX, JSON).
          You can self-host your own instance and migrate your data completely.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Error Tracking (Sentry)</h2>
        <p className="mt-2 text-gray-600">
          Both apps use <a href="https://sentry.io" className="text-blue-600 hover:underline">Sentry</a> for
          error monitoring. This helps us find and fix bugs quickly.
        </p>
        <h3 className="mt-4 font-medium text-gray-800">What Sentry collects:</h3>
        <ul className="mt-2 list-disc pl-6 text-gray-600 space-y-1">
          <li><strong>Error details</strong>: stack traces, error messages, browser/OS info</li>
          <li><strong>Performance traces</strong>: page load times, route navigation timing</li>
          <li><strong>Session replays on error</strong>: a recording of the session leading up to an error (DOM snapshots, not video)</li>
          <li><strong>User context</strong> (Journal only): user ID and username are attached to errors for debugging</li>
          <li><strong>Session ID</strong> (Planner only): the anonymous session ID is attached to errors</li>
        </ul>
        <h3 className="mt-4 font-medium text-gray-800">What Sentry does NOT collect:</h3>
        <ul className="mt-2 list-disc pl-6 text-gray-600 space-y-1">
          <li>Route or GPX data</li>
          <li>Passwords or passkey credentials</li>
          <li>Form input contents (masked in replays)</li>
        </ul>
        <h3 className="mt-4 font-medium text-gray-800">Data retention:</h3>
        <p className="mt-2 text-gray-600">
          Sentry data is retained for 90 days and then automatically deleted.
          Sentry&apos;s servers are hosted in the EU (Frankfurt).
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Third Parties</h2>
        <ul className="mt-3 list-disc pl-6 text-gray-600 space-y-1">
          <li><strong>Sentry</strong> (Functional Software Inc.) — error tracking, as described above</li>
          <li><strong>OpenStreetMap</strong> — map tiles are loaded from OSM tile servers. OSM&apos;s <a href="https://wiki.osmfoundation.org/wiki/Privacy_Policy" className="text-blue-600 hover:underline">privacy policy</a> applies to tile requests.</li>
          <li><strong>BRouter</strong> — routing requests are processed by our self-hosted BRouter instance. No data is sent to third parties for routing.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">What We Don&apos;t Do</h2>
        <ul className="mt-3 list-disc pl-6 text-gray-600 space-y-1">
          <li>We don&apos;t sell data</li>
          <li>We don&apos;t show ads</li>
          <li>We don&apos;t build user profiles</li>
          <li>We don&apos;t use tracking pixels or analytics</li>
          <li>We don&apos;t share data with anyone except as listed above</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Security Practices</h2>
        <ul className="mt-3 list-disc pl-6 text-gray-600 space-y-1">
          <li><strong>Authentication</strong>: Passkey (WebAuthn) and magic link login. No passwords stored.</li>
          <li><strong>Encryption</strong>: All traffic over HTTPS with HSTS preload. Cookies are httpOnly and secure.</li>
          <li><strong>Headers</strong>: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options on all responses.</li>
          <li><strong>Infrastructure</strong>: Docker containers run as non-root. Firewall restricts to HTTP/HTTPS/SSH only.</li>
          <li><strong>CI/CD</strong>: Gitleaks secret scanning and dependency auditing on every pull request.</li>
          <li><strong>Vulnerability reporting</strong>: See our <a href="https://github.com/trails-cool/trails/blob/main/SECURITY.md" className="text-blue-600 hover:underline">SECURITY.md</a> for responsible disclosure.</li>
        </ul>
      </section>

      <p className="mt-10 text-sm text-gray-500">
        Last updated: March 2026. If this manifest changes, we&apos;ll note it here.
      </p>
    </div>
  );
}
