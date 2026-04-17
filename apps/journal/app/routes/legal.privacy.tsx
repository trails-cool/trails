import { operator } from "~/lib/operator";

export function meta() {
  return [
    { title: "Datenschutzerklärung — trails.cool" },
    { name: "robots", content: "noindex" },
  ];
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">
        Datenschutzerklärung / Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: 2026-04-17</p>

      {/* GDPR formal sections */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">
          1. Verantwortliche Stelle / Data Controller
        </h2>
        <p className="mt-2 text-gray-600">
          Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne
          der DSGVO ist:
        </p>
        <address className="mt-2 not-italic text-gray-700">
          {operator.name}
          <br />
          {operator.address.street}
          <br />
          {operator.address.postalCode} {operator.address.city}
          <br />
          {operator.address.country}
          <br />
          E-Mail:{" "}
          <a className="text-blue-600 hover:underline" href={`mailto:${operator.email}`}>
            {operator.email}
          </a>
        </address>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">
          2. Rechtsgrundlagen / Legal Basis
        </h2>
        <p className="mt-2 text-gray-600">
          Wir verarbeiten personenbezogene Daten auf Grundlage folgender
          Rechtsgrundlagen:
        </p>
        <ul className="mt-3 list-disc pl-6 text-gray-600 space-y-1">
          <li>
            <strong>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)</strong>:
            Kontoverwaltung, Speicherung von Routen und Aktivitäten, Anmeldung
            via Passkey / Magic Link.
          </li>
          <li>
            <strong>Berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO)</strong>:
            Fehlerüberwachung (Sentry) zur Sicherstellung der
            Funktionsfähigkeit des Dienstes.
          </li>
          <li>
            <strong>Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)</strong>: Bei
            ausdrücklicher Zustimmung zu den Nutzungsbedingungen während der
            Registrierung.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">
          3. Ihre Rechte / Your Rights
        </h2>
        <p className="mt-2 text-gray-600">
          Als betroffene Person stehen Ihnen folgende Rechte nach DSGVO zu:
        </p>
        <ul className="mt-3 list-disc pl-6 text-gray-600 space-y-1">
          <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
          <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
          <li>Recht auf Löschung (Art. 17 DSGVO)</li>
          <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>Widerspruchsrecht (Art. 21 DSGVO)</li>
          <li>Recht auf Widerruf einer Einwilligung (Art. 7 Abs. 3 DSGVO)</li>
        </ul>
        <p className="mt-3 text-gray-600">
          Zur Ausübung dieser Rechte wenden Sie sich bitte an{" "}
          <a className="text-blue-600 hover:underline" href={`mailto:${operator.email}`}>
            {operator.email}
          </a>
          . Ein vollständiger Export Ihrer Daten ist jederzeit direkt über die
          Einstellungen Ihres Kontos möglich (Routen als GPX, Aktivitäten als
          GPX/JSON). Sie können Ihr Konto jederzeit selbst löschen.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">
          4. Beschwerderecht / Right to Complain
        </h2>
        <p className="mt-2 text-gray-600">
          Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu
          beschweren. Zuständig für uns ist:
        </p>
        <address className="mt-2 not-italic text-gray-700">
          Berliner Beauftragte für Datenschutz und Informationsfreiheit
          <br />
          Friedrichstr. 219
          <br />
          10969 Berlin
          <br />
          <a
            className="text-blue-600 hover:underline"
            href="https://www.datenschutz-berlin.de"
          >
            www.datenschutz-berlin.de
          </a>
        </address>
      </section>

      <hr className="my-10 border-gray-200" />

      {/* Existing privacy manifest (plain-language) */}
      <h2 className="text-2xl font-bold text-gray-900">Privacy Manifest</h2>
      <p className="mt-4 text-gray-600">
        trails.cool is committed to privacy by design. This manifest documents
        everything we collect, why, and how you can control it.
      </p>

      <section className="mt-10">
        <h3 className="text-xl font-semibold text-gray-900">Planner (planner.trails.cool)</h3>
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
        <h3 className="text-xl font-semibold text-gray-900">Journal (trails.cool)</h3>
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
        <h3 className="text-xl font-semibold text-gray-900">Error Tracking (Sentry)</h3>
        <p className="mt-2 text-gray-600">
          Both apps use <a href="https://sentry.io" className="text-blue-600 hover:underline">Sentry</a> for
          error monitoring. This helps us find and fix bugs quickly.
        </p>
        <h4 className="mt-4 font-medium text-gray-800">What Sentry collects:</h4>
        <ul className="mt-2 list-disc pl-6 text-gray-600 space-y-1">
          <li><strong>Error details</strong>: stack traces, error messages, browser/OS info</li>
          <li><strong>Performance traces</strong>: page load times, route navigation timing</li>
          <li><strong>Session replays on error</strong>: a recording of the session leading up to an error (DOM snapshots, not video)</li>
          <li><strong>User context</strong> (Journal only): only the user ID (not username or email) is attached to errors for debugging</li>
          <li><strong>Session ID</strong> (Planner only): the anonymous session ID is attached to errors</li>
        </ul>
        <h4 className="mt-4 font-medium text-gray-800">What Sentry does NOT collect:</h4>
        <ul className="mt-2 list-disc pl-6 text-gray-600 space-y-1">
          <li>Route or GPX data</li>
          <li>Passwords or passkey credentials</li>
          <li>Form input contents (masked in replays)</li>
        </ul>
        <h4 className="mt-4 font-medium text-gray-800">Data retention:</h4>
        <p className="mt-2 text-gray-600">
          Sentry data is retained for 90 days and then automatically deleted.
          Sentry&apos;s servers are hosted in the EU (Frankfurt).
        </p>
      </section>

      <section className="mt-10">
        <h3 className="text-xl font-semibold text-gray-900">Email</h3>
        <p className="mt-2 text-gray-600">
          The Journal sends transactional emails for magic link login and welcome messages
          via SMTP. On the official instance, emails are sent through our own mail server.
        </p>
        <h4 className="mt-4 font-medium text-gray-800">What is sent via email:</h4>
        <ul className="mt-2 list-disc pl-6 text-gray-600 space-y-1">
          <li><strong>Magic link</strong>: a one-time login link sent to your email address</li>
          <li><strong>Welcome email</strong>: a greeting after registration</li>
        </ul>
        <p className="mt-3 text-gray-600">
          Self-hosted instances can configure their own SMTP server. No email content
          is stored beyond what your mail server retains.
        </p>
      </section>

      <section className="mt-10">
        <h3 className="text-xl font-semibold text-gray-900">Third Parties</h3>
        <ul className="mt-3 list-disc pl-6 text-gray-600 space-y-1">
          <li><strong>Sentry</strong> (Functional Software Inc.) — error tracking, as described above</li>
          <li><strong>OpenStreetMap</strong> — map tiles are loaded from OSM tile servers. OSM&apos;s <a href="https://wiki.osmfoundation.org/wiki/Privacy_Policy" className="text-blue-600 hover:underline">privacy policy</a> applies to tile requests.</li>
          <li><strong>BRouter</strong> — routing requests are processed by our self-hosted BRouter instance. No data is sent to third parties for routing.</li>
          <li><strong>SMTP provider</strong> — transactional emails (magic link, welcome) are delivered via SMTP. Self-hosters configure their own provider.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h3 className="text-xl font-semibold text-gray-900">What We Don&apos;t Do</h3>
        <ul className="mt-3 list-disc pl-6 text-gray-600 space-y-1">
          <li>We don&apos;t sell data</li>
          <li>We don&apos;t show ads</li>
          <li>We don&apos;t build user profiles</li>
          <li>We don&apos;t use tracking pixels or analytics</li>
          <li>We don&apos;t share data with anyone except as listed above</li>
        </ul>
      </section>

      <section className="mt-10">
        <h3 className="text-xl font-semibold text-gray-900">Security Practices</h3>
        <ul className="mt-3 list-disc pl-6 text-gray-600 space-y-1">
          <li><strong>Authentication</strong>: Passkey (WebAuthn) and magic link login. No passwords stored.</li>
          <li><strong>Encryption</strong>: All traffic over HTTPS with HSTS preload. Cookies are httpOnly and secure.</li>
          <li><strong>Headers</strong>: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options on all responses.</li>
          <li><strong>Infrastructure</strong>: Docker containers run as non-root. Firewall restricts to HTTP/HTTPS/SSH only.</li>
          <li><strong>CI/CD</strong>: Gitleaks secret scanning and dependency auditing on every pull request.</li>
          <li><strong>Vulnerability reporting</strong>: See our <a href="https://github.com/trails-cool/trails/blob/main/SECURITY.md" className="text-blue-600 hover:underline">SECURITY.md</a> for responsible disclosure.</li>
        </ul>
      </section>
    </div>
  );
}
