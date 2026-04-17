export function meta() {
  return [
    { title: "Terms of Service — trails.cool" },
    { name: "robots", content: "noindex" },
  ];
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">
        Nutzungsbedingungen / Terms of Service
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Last updated: 2026-04-17 • Alpha version — subject to change
      </p>

      {/* Deutsche Fassung (maßgebend) */}
      <section className="mt-10 space-y-4 text-gray-700">
        <h2 className="text-xl font-semibold text-gray-900">Deutsche Fassung</h2>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          1. Gegenstand und Alpha-Status
        </h3>
        <p className="text-sm">
          trails.cool ist ein experimenteller Dienst zur Planung und Dokumentation
          von Outdoor-Aktivitäten. Der Dienst befindet sich in aktiver Entwicklung
          (Alpha). Funktionen, Schnittstellen und gespeicherte Daten können
          jederzeit ohne Vorankündigung geändert, gelöscht oder eingestellt
          werden. Eine Verfügbarkeitsgarantie besteht nicht.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          2. Zurücksetzen der Datenbank
        </h3>
        <p className="text-sm">
          Während der Alpha-Phase behält sich der Betreiber ausdrücklich das Recht
          vor, die gesamte Datenbank zurückzusetzen oder einzelne Datensätze ohne
          vorherige Benachrichtigung zu löschen. Nutzer:innen sollten wichtige
          Routen und Aktivitäten selbstständig über die Export-Funktion (GPX)
          sichern.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          3. Haftungsausschluss
        </h3>
        <p className="text-sm">
          Der Dienst wird ohne jegliche Gewährleistung bereitgestellt. Eine Haftung
          für Schäden, die durch die Nutzung oder Nichtverfügbarkeit des Dienstes
          entstehen, ist ausgeschlossen, soweit dies gesetzlich zulässig ist. Bei
          Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper
          und Gesundheit gelten die gesetzlichen Vorschriften.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          4. Nutzungsregeln
        </h3>
        <ul className="ml-6 list-disc space-y-1 text-sm">
          <li>Keine Verbreitung rechtswidriger Inhalte</li>
          <li>Keine missbräuchliche Nutzung (Spam, automatisierte Abfragen in
            hoher Frequenz, Denial-of-Service)
          </li>
          <li>Kein Umgehen technischer Schutzmaßnahmen</li>
        </ul>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          5. Eigenverantwortung für Daten
        </h3>
        <p className="text-sm">
          Nutzer:innen sind dafür verantwortlich, regelmäßig Sicherungskopien ihrer
          Routen und Aktivitäten anzufertigen. GPX-Exporte sind im Journal für
          jede Route und Aktivität verfügbar.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          6. Beendigung
        </h3>
        <p className="text-sm">
          Nutzer:innen können ihr Konto jederzeit über die Einstellungen löschen.
          Der Betreiber kann Konten bei Verstößen gegen diese Bedingungen sperren
          oder löschen.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          7. Änderungen
        </h3>
        <p className="text-sm">
          Diese Nutzungsbedingungen können sich während der Alpha-Phase ändern. Bei
          wesentlichen Änderungen werden registrierte Nutzer:innen per E-Mail
          informiert und müssen die neuen Bedingungen erneut bestätigen.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          8. Anwendbares Recht
        </h3>
        <p className="text-sm">
          Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Verbraucher:innen
          mit gewöhnlichem Aufenthalt in der EU genießen den zwingenden Schutz
          ihres nationalen Verbraucherrechts.
        </p>
      </section>

      <hr className="my-12 border-gray-200" />

      {/* English translation (informational) */}
      <section className="space-y-4 text-gray-700">
        <h2 className="text-xl font-semibold text-gray-900">English version</h2>
        <p className="text-xs text-gray-500">
          The German version is authoritative. This English text is a translation
          for convenience.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          1. Alpha status
        </h3>
        <p className="text-sm">
          trails.cool is an experimental service for planning and documenting
          outdoor activities. It is under active development (alpha). Features,
          APIs, and stored data may change, be deleted, or be discontinued at any
          time without notice. No availability is guaranteed.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          2. Database resets
        </h3>
        <p className="text-sm">
          During alpha, the operator expressly reserves the right to reset the
          entire database or delete individual records without prior notice. Users
          should back up important routes and activities via the GPX export.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          3. No warranty
        </h3>
        <p className="text-sm">
          The service is provided without any warranty. Liability for damages
          arising from use or unavailability is excluded to the maximum extent
          permitted by law. Statutory provisions apply for intent, gross
          negligence, and injury to life, body, or health.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          4. Acceptable use
        </h3>
        <ul className="ml-6 list-disc space-y-1 text-sm">
          <li>No illegal content</li>
          <li>No abusive use (spam, high-frequency automated requests, denial of service)</li>
          <li>No circumvention of technical protections</li>
        </ul>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          5. Data responsibility
        </h3>
        <p className="text-sm">
          Users are responsible for regularly backing up their routes and
          activities. GPX exports are available in the Journal for every route
          and activity.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          6. Termination
        </h3>
        <p className="text-sm">
          Users can delete their account at any time via settings. The operator
          may suspend or delete accounts that violate these terms.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          7. Changes
        </h3>
        <p className="text-sm">
          These terms may change during alpha. Registered users will be notified
          by email of material changes and must re-accept the updated terms.
        </p>

        <h3 className="mt-6 text-base font-semibold text-gray-900">
          8. Governing law
        </h3>
        <p className="text-sm">
          German law applies, excluding the UN Convention on Contracts for the
          International Sale of Goods. Consumers habitually residing in the EU
          retain the mandatory protection of their national consumer law.
        </p>
      </section>
    </div>
  );
}
