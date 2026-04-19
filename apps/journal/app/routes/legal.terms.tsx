export function meta() {
  return [
    { title: "Nutzungsbedingungen — trails.cool" },
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
        Stand / Last updated: 2026-04-18 • Alpha — subject to change. Die
        deutsche Fassung ist maßgeblich. The German version is authoritative;
        English summaries follow each section.
      </p>

      <section className="mt-10 space-y-6 text-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            1. Gegenstand und Alpha-Status
          </h2>
          <p className="mt-2 text-sm">
            trails.cool ist ein experimenteller, derzeit kostenloser Dienst zur Planung
            und Dokumentation von Outdoor-Aktivitäten. Der Dienst befindet sich
            in aktiver Entwicklung (Alpha). Funktionen, Schnittstellen und
            gespeicherte Daten können jederzeit ohne Vorankündigung geändert,
            unterbrochen, gelöscht oder eingestellt werden. Eine
            Verfügbarkeitsgarantie besteht nicht.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            <em>English.</em> trails.cool is an experimental service,
            currently free of charge, in
            active alpha development. Features, data, and availability can
            change at any time without notice. No availability is guaranteed.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            2. Mindestalter
          </h2>
          <p className="mt-2 text-sm">
            Die Nutzung eines Journal-Kontos ist erst ab einem Alter von 16
            Jahren zulässig. Anonyme Nutzung des Planners unterliegt keiner
            Altersbeschränkung.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            <em>English.</em> A Journal account is available only to users
            aged 16 or older. Anonymous use of the Planner has no age
            requirement.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            3. Dienstverfügbarkeit
          </h2>
          <p className="mt-2 text-sm">
            Der Betreiber kann den Dienst jederzeit ändern, einschränken,
            unterbrechen oder einstellen, auch einzelne Funktionen oder
            einzelne Konten. Wartungs- und Ausfallzeiten sind möglich.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            <em>English.</em> The operator may modify, limit, interrupt, or
            discontinue the service (or parts of it, or individual accounts)
            at any time. Downtime and maintenance windows may occur.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            4. Zurücksetzen der Datenbank
          </h2>
          <p className="mt-2 text-sm">
            Während der Alpha-Phase behält sich der Betreiber ausdrücklich das
            Recht vor, die gesamte Datenbank zurückzusetzen oder einzelne
            Datensätze ohne vorherige Benachrichtigung zu löschen.
            Nutzer:innen sollten wichtige Routen und Aktivitäten selbstständig
            über die Export-Funktion (GPX bzw. JSON) sichern.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            <em>English.</em> During alpha, the operator may reset the entire
            database or delete individual records without notice. Back up
            anything important via the GPX / JSON export.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            5. Eigenverantwortung für Daten
          </h2>
          <p className="mt-2 text-sm">
            Nutzer:innen sind für die Sicherung ihrer Inhalte selbst
            verantwortlich. GPX- und JSON-Exporte sind im Journal jederzeit
            für jede Route und Aktivität verfügbar. Der Betreiber schuldet
            keine Datenwiederherstellung.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            <em>English.</em> You are responsible for backing up your own
            content. Exports are always available in the Journal; the
            operator owes no data recovery.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            6. Inhalte und Nutzungsrechte
          </h2>
          <p className="mt-2 text-sm">
            Die von Ihnen eingestellten Inhalte (Routen, Aktivitäten,
            Beschreibungen, GPX-Dateien) bleiben Ihr Eigentum. Sie räumen dem
            Betreiber lediglich das einfache, nicht übertragbare Recht ein,
            diese Inhalte zum Zweck des Betriebs des Dienstes zu speichern,
            zu verarbeiten und Ihnen wieder anzuzeigen. Eine darüber
            hinausgehende Nutzung, Veröffentlichung oder Weitergabe findet
            nicht statt.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            <em>English.</em> You retain ownership of everything you upload.
            You grant the operator a limited, non-transferable licence to
            store, process, and display your content solely for operating the
            service; no other use, publication, or sharing.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            7. Nutzungsregeln
          </h2>
          <ul className="mt-2 ml-6 list-disc space-y-1 text-sm">
            <li>Keine Verbreitung rechtswidriger Inhalte</li>
            <li>
              Keine missbräuchliche Nutzung (Spam, hochfrequente automatisierte
              Abfragen, Denial-of-Service)
            </li>
            <li>Kein Umgehen technischer Schutzmaßnahmen</li>
            <li>Kein massenhaftes automatisiertes Auslesen von Daten</li>
          </ul>
          <p className="mt-2 text-xs text-gray-600">
            <em>English.</em> No illegal content, no abuse (spam, flooding,
            DoS), no circumvention of technical protections, no bulk
            automated data extraction.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            8. Kontobeendigung
          </h2>
          <p className="mt-2 text-sm">
            Sie können Ihr Konto jederzeit über die Einstellungen löschen;
            damit werden auch die zugehörigen Inhalte gelöscht. Der Betreiber
            kann Konten bei Verstößen gegen diese Bedingungen nach
            angemessener Interessenabwägung sperren oder löschen.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            <em>English.</em> Delete your account (and its content) any time
            via settings. The operator may suspend or delete accounts that
            violate these terms, balancing interests reasonably.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            9. Haftung
          </h2>
          <p className="mt-2 text-sm">
            Der Dienst wird ohne Gewährleistung bereitgestellt. Der Betreiber
            haftet uneingeschränkt bei Vorsatz und grober Fahrlässigkeit sowie
            bei Verletzung von Leben, Körper oder Gesundheit. Im Übrigen ist
            die Haftung für leicht fahrlässige Pflichtverletzungen auf den
            vertragstypischen, vorhersehbaren Schaden bei Verletzung
            wesentlicher Vertragspflichten (Kardinalpflichten) begrenzt. Eine
            darüber hinausgehende Haftung – insbesondere für Datenverlust –
            ist ausgeschlossen, soweit gesetzlich zulässig.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            <em>English.</em> No warranty. Unlimited liability for intent,
            gross negligence, and injury to life, body, or health. For
            slight negligence, liability is limited to foreseeable damages
            arising from breach of material contractual duties. Liability
            beyond that — in particular for data loss — is excluded to the
            extent permitted by law.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            10. Änderungen der Bedingungen
          </h2>
          <p className="mt-2 text-sm">
            Diese Nutzungsbedingungen können sich während der Alpha-Phase
            ändern. Bei wesentlichen Änderungen werden registrierte
            Nutzer:innen per E-Mail informiert und müssen die neuen
            Bedingungen erneut bestätigen.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            <em>English.</em> These terms may change during alpha. Registered
            users will be emailed about material changes and prompted to
            re-accept.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            11. Anwendbares Recht
          </h2>
          <p className="mt-2 text-sm">
            Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Für
            Verbraucher:innen mit gewöhnlichem Aufenthalt in einem Mitgliedstaat
            der Europäischen Union bleibt der zwingende Schutz des Rechts ihres
            Aufenthaltslandes unberührt.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            <em>English.</em> German law applies, excluding the UN Convention
            on Contracts for the International Sale of Goods. Consumers
            habitually residing in an EU member state retain the mandatory
            protection of their national law.
          </p>
        </div>
      </section>
    </div>
  );
}
