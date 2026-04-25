import { operator } from "~/lib/operator";
import { PRIVACY_LAST_UPDATED } from "~/lib/legal";

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
      <p className="mt-2 text-sm text-gray-500">
        Stand / Last updated: {PRIVACY_LAST_UPDATED}. Die deutsche Fassung ist maßgeblich.
        The German version is authoritative; English summaries follow each
        section.
      </p>

      {/* ================================================================
          1. Verantwortlicher / Data controller
         ================================================================ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">
          1. Verantwortlicher
        </h2>
        <p className="mt-2 text-gray-700">
          Verantwortlich für die Datenverarbeitung im Sinne der DSGVO ist:
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
        <p className="mt-3 text-sm text-gray-600">
          <em>English.</em> Data controller under GDPR is the party named
          above. Contact for any data-protection matter: {operator.email}.
        </p>
      </section>

      {/* ================================================================
          2. Erhobene Daten & Zwecke / Data categories & purposes
         ================================================================ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">
          2. Erhobene Daten und Zwecke
        </h2>
        <p className="mt-2 text-gray-700">
          Wir verarbeiten nur die Daten, die für den Betrieb der jeweiligen
          Funktion erforderlich sind. trails.cool besteht aus zwei Teilen:
          dem <strong>Journal</strong> (trails.cool, mit Konto) und dem{" "}
          <strong>Planner</strong> (planner.trails.cool, anonym).
        </p>
        <ul className="mt-3 list-disc pl-6 text-gray-700 space-y-2">
          <li>
            <strong>Kontodaten (Journal):</strong> E-Mail-Adresse,
            Benutzername, Anzeigename, Passkey-Public-Key. Zweck:
            Kontoverwaltung und Anmeldung.
          </li>
          <li>
            <strong>Nutzerinhalte (Journal):</strong> Routen (GPX-Daten,
            Geometrie, Titel, Beschreibung) und Aktivitäten (Titel,
            Beschreibung, Datum, Verknüpfung zu Routen). Zweck: Speicherung
            und Anzeige innerhalb des Dienstes. Jede Route und jede
            Aktivität hat eine Sichtbarkeits-Einstellung
            (<code>privat</code> / <code>nicht gelistet</code> / <code>öffentlich</code>),
            die standardmäßig auf <code>privat</code> gesetzt ist. Inhalte,
            die Sie ausdrücklich auf <code>öffentlich</code> setzen, sind
            weltweit abrufbar – einschließlich auf Ihrem öffentlichen
            Profil unter <code>/users/&lt;benutzername&gt;</code> – und
            können von Suchmaschinen indexiert werden.
          </li>
          <li>
            <strong>Anmeldedaten (Journal):</strong> kurzlebige Magic-Link-Token
            (zur E-Mail-basierten Anmeldung). Zweck: Authentifizierung.
          </li>
          <li>
            <strong>Sitzungscookie (Journal):</strong> eine zufällige
            Sitzungs-ID nach dem Einloggen. Zweck: Authentifizierung während
            der Sitzung.
          </li>
          <li>
            <strong>Planner-Sitzungsdaten:</strong> anonyme Sitzungs-ID,
            kollaborativer Zustand (Wegpunkte, Notizen). Keine Zuordnung zu
            einer Person. Zweck: gemeinsames Planen von Routen.
          </li>
          <li>
            <strong>Server-Logfiles:</strong> IP-Adresse, Zeitstempel,
            HTTP-Methode, Pfad, Statuscode, User-Agent. Zweck: Sicherheit,
            Betrieb, Fehlersuche. Details siehe Abschnitt 4.
          </li>
          <li>
            <strong>Fehlerdaten (Sentry):</strong> Stacktraces,
            Fehlermeldungen, Browser-/OS-Information aus dem User-Agent,
            Performance-Metriken. Bei eingeloggten Journal-Nutzer:innen
            zusätzlich die Nutzer-ID (keine E-Mail, kein Benutzername).
            IP-Adressen werden nicht aktiv gespeichert, ebenso keine Cookies
            und keine Formulareingaben.
          </li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">
          <em>English.</em> The Journal stores only what you provide (account
          details and your own routes/activities) plus short-lived auth
          artefacts. Each route and activity has a visibility setting
          (<code>private</code> / <code>unlisted</code> / <code>public</code>)
          that defaults to <code>private</code>; content you mark{" "}
          <code>public</code> is world-visible (on your public profile and
          indexable by search engines). The Planner is anonymous and holds
          only ephemeral session state. Server logs and Sentry error data
          are covered separately below.
        </p>
      </section>

      {/* ================================================================
          3. Rechtsgrundlagen / Legal bases
         ================================================================ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">3. Rechtsgrundlagen</h2>
        <ul className="mt-3 list-disc pl-6 text-gray-700 space-y-2">
          <li>
            <strong>Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung):</strong>{" "}
            Kontoführung, Anmeldung per Passkey oder Magic Link, Speicherung
            und Anzeige der von Ihnen erstellten Routen und Aktivitäten,
            Versand notwendiger Transaktions-E-Mails, Bereitstellung anonymer
            Planner-Sitzungen. Ein Konto sowie die Bestätigung der
            Nutzungsbedingungen sind Bestandteil dieses Nutzungsvertrags –
            sie sind <em>keine</em> Einwilligung im Sinne von Art. 6 Abs. 1
            lit. a DSGVO.
          </li>
          <li>
            <strong>Art. 6 Abs. 1 lit. f DSGVO (berechtigte Interessen):</strong>{" "}
            kurzzeitige Server-Logfiles zur Sicherung des Betriebs und zur
            Missbrauchsabwehr, Rate-Limiting, Fehlermonitoring über Sentry
            zur Sicherstellung der Funktionsfähigkeit des Dienstes.
          </li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">
          <em>English.</em> Contract (Art. 6(1)(b)) covers everything
          account- and content-related; legitimate interests (Art. 6(1)(f))
          cover short-lived server logs, rate-limiting, and error monitoring.
          We do <strong>not</strong> rely on consent for any of this.
        </p>
      </section>

      {/* ================================================================
          4. Server-Logfiles / Server logs
         ================================================================ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">4. Server-Logfiles</h2>
        <p className="mt-2 text-gray-700">
          Beim Aufruf der Dienste werden automatisch technische Informationen
          protokolliert:
        </p>
        <ul className="mt-3 list-disc pl-6 text-gray-700 space-y-1">
          <li>IP-Adresse</li>
          <li>Zeitstempel</li>
          <li>HTTP-Methode, Pfad, Statuscode</li>
          <li>User-Agent (Browser, Betriebssystem)</li>
        </ul>
        <p className="mt-3 text-gray-700">
          <strong>Zweck:</strong> Sicherheit, Betrieb und Fehlersuche.{" "}
          <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO.{" "}
          <strong>Speicherdauer:</strong> maximal 14 Tage, danach automatische
          Löschung. Eine Zusammenführung dieser Daten mit anderen Datenquellen
          findet nicht statt.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          <em>English.</em> HTTP requests to our servers are logged (IP,
          timestamp, method, path, status, user-agent) for up to 14 days for
          operational and security purposes under Art. 6(1)(f), then deleted.
        </p>
      </section>

      {/* ================================================================
          5. Speicherdauer / Storage durations
         ================================================================ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">5. Speicherdauer</h2>
        <ul className="mt-3 list-disc pl-6 text-gray-700 space-y-1">
          <li>Konto und zugehörige Inhalte: bis zur Löschung durch Sie</li>
          <li>Planner-Sitzungen: automatische Löschung nach 7 Tagen Inaktivität</li>
          <li>Magic-Link-Token: 15 Minuten</li>
          <li>Server-Logfiles: maximal 14 Tage</li>
          <li>Fehlerdaten (Sentry): 90 Tage</li>
        </ul>
        <p className="mt-3 text-sm text-gray-700">
          Hinweis Alpha: Während der Alpha-Phase behält sich der Betreiber
          ausdrücklich vor, die Datenbank zurückzusetzen oder einzelne
          Datensätze zu löschen. Dies kann zu Datenverlust führen, bevor Sie
          eine Löschung veranlassen. Details dazu in den Nutzungsbedingungen.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          <em>English.</em> Account and content kept until you delete them.
          Ephemeral data (sessions, magic-link tokens, logs, Sentry events)
          deleted automatically on the schedules above. Alpha caveat: the
          operator may reset the database or delete individual records
          during alpha, which can cause data loss before you request
          deletion. See the Terms of Service.
        </p>
      </section>

      {/* ================================================================
          6. Empfänger / Third parties
         ================================================================ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">6. Empfänger und Drittanbieter</h2>
        <p className="mt-2 text-gray-700">
          Wir geben personenbezogene Daten nur an die unten genannten
          Auftragsverarbeiter und Dritten weiter, und auch dort nur im
          jeweils notwendigen Umfang.
        </p>
        <ul className="mt-3 list-disc pl-6 text-gray-700 space-y-3">
          <li>
            <strong>Sentry</strong> (Functional Software Inc.) – Fehler- und
            Performance-Monitoring. Was übermittelt wird: Stacktraces,
            Fehlertext, Browser-/OS-Informationen aus dem User-Agent,
            Performance-Daten; bei eingeloggten Journal-Nutzer:innen
            zusätzlich die Nutzer-ID. IP-Adressen werden nicht aktiv
            gespeichert (<code>sendDefaultPii</code> ist deaktiviert), ebenso
            keine Cookies und keine vollständigen HTTP-Header. Keine
            Session-Replays. Sentry agiert als externer Dienstleister
            (Auftragsverarbeiter) für die Fehlerbehandlung. Da Sentry ein
            Anbieter mit Sitz in den USA ist, kann im Einzelfall eine
            Übermittlung personenbezogener Daten in ein Drittland im Sinne
            der Art. 44 ff. DSGVO stattfinden; wir stützen uns hierbei auf
            die von Sentry bereitgestellten
            Standardvertragsklauseln.
          </li>
          <li>
            <strong>OpenStreetMap</strong> – Kartenkacheln werden beim Anzeigen
            der Karten direkt vom Browser von OSM-Tile-Servern geladen. Dabei
            werden <strong>IP-Adresse und User-Agent</strong> an OSM übertragen.
            Dies ist notwendig, um überhaupt eine Karte darzustellen; es gilt
            die{" "}
            <a
              className="text-blue-600 hover:underline"
              href="https://wiki.osmfoundation.org/wiki/Privacy_Policy"
            >
              OSM Foundation Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong>Overpass API</strong> (POI-Daten) – POI-Abfragen laufen
            serverseitig über unsere eigene Route <code>/api/overpass</code>.
            Der Upstream-Dienst sieht nur unsere Server-IP, nicht die Ihrer
            Nutzer:innen. Aktueller Upstream: <code>overpass.private.coffee</code>
            , der ohne Query-Logs arbeitet. Eine selbst gehostete Instanz ist
            geplant.
          </li>
          <li>
            <strong>BRouter</strong> – Routenberechnung läuft auf einer von uns
            selbst gehosteten Instanz. Keine Weitergabe an Dritte.
          </li>
          <li>
            <strong>E-Mail-Versand</strong> – Transaktions-E-Mails (Magic
            Link, Willkommensnachricht) werden über einen konfigurierten
            externen SMTP-Dienst versendet. Dabei wird die E-Mail-Adresse
            der Empfänger:in an diesen Dienst übergeben. Selbst-betriebene
            Instanzen konfigurieren ihren eigenen Mailserver.
          </li>
          <li>
            <strong>Hosting</strong> – Die Dienste werden in Rechenzentren
            innerhalb der EU betrieben. Ein Auftragsverarbeitungsvertrag mit
            dem Hoster besteht.
          </li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">
          <em>English.</em> Third parties and what they receive: Sentry (error
          details, no IPs/cookies); OpenStreetMap tile servers
          (your IP and user-agent, directly from your browser, to load map
          tiles); Overpass (via our server-side proxy, so upstream only sees
          our server); BRouter (self-hosted, no third party involved); SMTP
          provider (your email address for magic link / welcome mail);
          hosting provider in the EU under a DPA.
        </p>
      </section>

      {/* ================================================================
          7. Ihre Rechte / Rights
         ================================================================ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">7. Ihre Rechte</h2>
        <p className="mt-2 text-gray-700">
          Als betroffene Person stehen Ihnen die folgenden Rechte zu:
        </p>
        <ul className="mt-3 list-disc pl-6 text-gray-700 space-y-1">
          <li>Auskunft (Art. 15 DSGVO)</li>
          <li>Berichtigung (Art. 16 DSGVO)</li>
          <li>Löschung (Art. 17 DSGVO)</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>Widerspruch gegen Verarbeitung auf Basis berechtigter Interessen (Art. 21 DSGVO)</li>
        </ul>
        <p className="mt-3 text-gray-700">
          Zur Ausübung dieser Rechte genügt eine formlose E-Mail an{" "}
          <a className="text-blue-600 hover:underline" href={`mailto:${operator.email}`}>
            {operator.email}
          </a>
          . Einen vollständigen Export Ihrer Routen und Aktivitäten können Sie
          jederzeit direkt in den Kontoeinstellungen herunterladen (GPX bzw.
          JSON). Ihr Konto samt Inhalten können Sie dort ebenfalls selbst
          löschen.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          <em>English.</em> You have the standard GDPR rights (access,
          rectification, erasure, restriction, portability, objection). Email
          us to exercise them. Data exports and account deletion are also
          available directly in your account settings.
        </p>
      </section>

      {/* ================================================================
          8. Beschwerderecht / Complaint authority
         ================================================================ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">8. Beschwerderecht</h2>
        <p className="mt-2 text-gray-700">
          Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu
          beschweren. Für uns zuständig ist:
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
        <p className="mt-3 text-sm text-gray-600">
          <em>English.</em> You have the right to lodge a complaint with a
          supervisory authority; ours is the Berlin data-protection
          commissioner (address above).
        </p>
      </section>

      <hr className="my-12 border-gray-200" />

      {/* ================================================================
          Privacy Manifest (developer-friendly, plain language)
         ================================================================ */}
      <h2 className="text-2xl font-bold text-gray-900">Privacy Manifest</h2>
      <p className="mt-4 text-gray-700">
        A plain-language summary of what we do, for readers who prefer
        behaviour over paragraphs. Binding text is above.
      </p>

      <section className="mt-8">
        <h3 className="text-xl font-semibold text-gray-900">Planner (planner.trails.cool)</h3>
        <p className="mt-2 text-gray-700">
          Anonymous by design. No account, no identifier, nothing persisted
          past the session.
        </p>
        <ul className="mt-3 list-disc pl-6 text-gray-700 space-y-1">
          <li>No cookies, no localStorage, no sessionStorage</li>
          <li>No browser-side error tracking (Sentry is not loaded)</li>
          <li>Session data is deleted automatically after 7 days of inactivity</li>
        </ul>
      </section>

      <section className="mt-8">
        <h3 className="text-xl font-semibold text-gray-900">Journal (trails.cool)</h3>
        <p className="mt-2 text-gray-700">
          Holds only what you put in. Exportable any time, deletable any time.
        </p>
        <ul className="mt-3 list-disc pl-6 text-gray-700 space-y-1">
          <li>Account: email, username, display name, passkey public key</li>
          <li>Routes: GPX, geometry, title, description</li>
          <li>Activities: title, description, date, linked route</li>
          <li>GPX / JSON export available per object and overall</li>
          <li>
            Routes and activities each carry a visibility setting
            (<code>private</code> / <code>unlisted</code> / <code>public</code>)
            that defaults to <code>private</code>. Content you explicitly mark
            <code> public</code> is visible to anyone on the internet,
            including on your public profile at <code>/users/&lt;you&gt;</code>
            and on search engines that index those pages.
          </li>
          <li>
            Profile visibility (<code>public</code> / <code>private</code>,
            default <code>public</code>): a separate switch from content
            visibility. <code>private</code> 404s your profile page and makes
            you unfollowable; you can still post <code>public</code> content
            reachable by direct URL. Change anytime in account settings.
          </li>
          <li>
            Follows: which users on this instance follow which. Visible to
            anyone via your <code>/users/&lt;you&gt;/followers</code> and
            <code>/users/&lt;you&gt;/following</code> pages, mirroring
            Mastodon-style conventions. Set your profile to{" "}
            <code>private</code> to be unfollowable.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h3 className="text-xl font-semibold text-gray-900">Sentry</h3>
        <ul className="mt-3 list-disc pl-6 text-gray-700 space-y-1">
          <li>Journal server: always on</li>
          <li>Journal browser: only after login, torn down on logout</li>
          <li>Planner: server only; the browser never loads Sentry</li>
          <li>IPs not actively stored, no cookies, no full headers (<code>sendDefaultPii: false</code>)</li>
          <li>No replays (replay integration not installed, sample rates 0)</li>
          <li>User ID only (no email/username) on Journal-logged-in events</li>
        </ul>
      </section>

      <section className="mt-8">
        <h3 className="text-xl font-semibold text-gray-900">What we don&apos;t do</h3>
        <ul className="mt-3 list-disc pl-6 text-gray-700 space-y-1">
          <li>Sell data</li>
          <li>Show ads</li>
          <li>Build user profiles</li>
          <li>Run tracking pixels, analytics, or A/B tests</li>
        </ul>
      </section>

      <section className="mt-8">
        <h3 className="text-xl font-semibold text-gray-900">Security</h3>
        <ul className="mt-3 list-disc pl-6 text-gray-700 space-y-1">
          <li>Auth via passkey (WebAuthn) or magic link — no passwords stored</li>
          <li>HTTPS + HSTS preload on all origins; session cookies httpOnly + Secure</li>
          <li>CSP, X-Frame-Options, X-Content-Type-Options on every response</li>
          <li>Containers run non-root; host firewall restricts to HTTP/HTTPS/SSH</li>
          <li>Gitleaks + dependency audit on every PR</li>
          <li>
            Vulnerability reports:{" "}
            <a
              className="text-blue-600 hover:underline"
              href="https://github.com/trails-cool/trails/blob/main/SECURITY.md"
            >
              SECURITY.md
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
