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
      <h1 className="text-3xl font-bold text-gray-900">Impressum</h1>

      <section className="mt-8 space-y-4 text-gray-700">
        <h2 className="text-lg font-semibold text-gray-900">
          Angaben gemäß § 5 TMG
        </h2>
        <address className="not-italic">
          {operator.name}
          <br />
          {operator.address.street}
          <br />
          {operator.address.postalCode} {operator.address.city}
          <br />
          {operator.address.country}
        </address>

        <h2 className="text-lg font-semibold text-gray-900">Kontakt</h2>
        <p>
          E-Mail:{" "}
          <a
            className="text-blue-600 hover:underline"
            href={`mailto:${operator.email}`}
          >
            {operator.email}
          </a>
        </p>

        <h2 className="text-lg font-semibold text-gray-900">
          Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
        </h2>
        <address className="not-italic">
          {operator.responsiblePerson}
          <br />
          {operator.address.street}
          <br />
          {operator.address.postalCode} {operator.address.city}
        </address>

        <h2 className="text-lg font-semibold text-gray-900">Haftungsausschluss</h2>
        <p className="text-sm">
          Die Inhalte dieser Seiten wurden mit größtmöglicher Sorgfalt erstellt.
          Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte
          können wir jedoch keine Gewähr übernehmen. trails.cool befindet sich
          in aktiver Entwicklung (Alpha) — Inhalte, Funktionen und Daten können
          sich jederzeit ändern oder entfallen.
        </p>

        <p className="text-sm">
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte
          auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach
          §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht
          verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
          überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
          Tätigkeit hinweisen.
        </p>
      </section>

      <hr className="my-12 border-gray-200" />

      <section className="space-y-4 text-gray-700">
        <h2 className="text-lg font-semibold text-gray-900">
          Legal notice (English summary)
        </h2>
        <p className="text-sm">
          trails.cool is operated from Germany by {operator.name}, reachable at
          the address above and at{" "}
          <a
            className="text-blue-600 hover:underline"
            href={`mailto:${operator.email}`}
          >
            {operator.email}
          </a>
          . The service is currently in alpha — see the{" "}
          <a className="text-blue-600 hover:underline" href="/legal/terms">
            Terms of Service
          </a>{" "}
          for details.
        </p>
      </section>
    </div>
  );
}
