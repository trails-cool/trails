import { operator } from "~/lib/operator";

export function meta() {
  return [
    { title: "Impressum — trails.cool" },
    { name: "robots", content: "noindex" },
  ];
}

export default function ImprintPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Impressum / Legal Notice</h1>
      <p className="mt-2 text-xs text-gray-500">
        Die deutsche Fassung ist maßgeblich. / The German version is authoritative.
      </p>

      {/* ------------------------------------------------------------------
          Deutsche Fassung
         ------------------------------------------------------------------ */}

      <section className="mt-10 space-y-6 text-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Anbieter nach § 5 TMG
          </h2>
          <address className="mt-2 not-italic">
            {operator.name}
            <br />
            {operator.address.street}
            <br />
            {operator.address.postalCode} {operator.address.city}
            <br />
            {operator.address.country}
          </address>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">Kontakt</h2>
          <p className="mt-2">
            E-Mail:{" "}
            <a
              className="whitespace-nowrap text-blue-600 hover:underline"
              href={`mailto:${operator.email}`}
            >
              {operator.email}
            </a>
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Inhaltlich verantwortlich nach § 18 Abs. 2 MStV
          </h2>
          <address className="mt-2 not-italic">
            {operator.responsiblePerson}
            <br />
            {operator.address.street}
            <br />
            {operator.address.postalCode} {operator.address.city}
          </address>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">Streitbeilegung</h2>
          <p className="mt-2 text-sm">
            Die Europäische Kommission stellt eine Plattform zur
            Online-Streitbeilegung (OS) bereit:{" "}
            <a
              className="text-blue-600 hover:underline"
              href="https://ec.europa.eu/consumers/odr"
            >
              https://ec.europa.eu/consumers/odr
            </a>
            .
          </p>
          <p className="mt-2 text-sm">
            Wir sind nicht bereit oder verpflichtet, an
            Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
            teilzunehmen.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">Alpha-Status</h2>
          <p className="mt-2 text-sm">
            trails.cool befindet sich in aktiver Entwicklung (Alpha). Inhalte,
            Funktionen und Daten können sich jederzeit ändern oder entfallen.
          </p>
        </div>
      </section>

      <hr className="my-12 border-gray-200" />

      {/* ------------------------------------------------------------------
          English version
         ------------------------------------------------------------------ */}

      <section className="space-y-6 text-gray-700">
        <h2 className="text-xl font-semibold text-gray-900">English version</h2>

        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Service provider (§ 5 TMG)
          </h3>
          <address className="mt-2 not-italic text-sm">
            {operator.name}
            <br />
            {operator.address.street}
            <br />
            {operator.address.postalCode} {operator.address.city}
            <br />
            {operator.address.country}
          </address>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900">Contact</h3>
          <p className="mt-2 text-sm">
            Email:{" "}
            <a
              className="whitespace-nowrap text-blue-600 hover:underline"
              href={`mailto:${operator.email}`}
            >
              {operator.email}
            </a>
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Content responsibility (§ 18 (2) MStV)
          </h3>
          <p className="mt-2 text-sm">{operator.responsiblePerson}, address as above.</p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900">Dispute resolution</h3>
          <p className="mt-2 text-sm">
            The European Commission provides an online dispute resolution platform at{" "}
            <a
              className="text-blue-600 hover:underline"
              href="https://ec.europa.eu/consumers/odr"
            >
              https://ec.europa.eu/consumers/odr
            </a>
            . We are not willing or obliged to participate in dispute resolution
            proceedings before a consumer arbitration board.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900">Alpha status</h3>
          <p className="mt-2 text-sm">
            trails.cool is under active development (alpha). Features and data
            may change or be removed at any time.
          </p>
        </div>
      </section>
    </div>
  );
}
