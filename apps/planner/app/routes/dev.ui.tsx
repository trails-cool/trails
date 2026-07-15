import type { ReactNode } from "react";
import { Badge, Button, Card, Input } from "@trails-cool/ui";

/**
 * Dev-only gallery for the shared UI primitives. Renders every primitive in
 * its variants/states on one page so components can be built and eyeballed in
 * isolation — the lightweight alternative to Storybook. Registered only in
 * non-production builds (see routes.ts).
 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-mono text-xs uppercase tracking-wider text-text-lo">
        {title}
      </h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function DevUi() {
  return (
    <main className="mx-auto max-w-3xl space-y-10 p-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text-hi">UI primitives</h1>
        <p className="text-sm text-text-md">
          Shared <code className="font-mono">@trails-cool/ui</code> components on
          the design-system tokens.
        </p>
      </header>

      <Section title="Button · variants">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
      </Section>

      <Section title="Button · sizes">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
      </Section>

      <Section title="Badge · tones">
        <Badge>Neutral</Badge>
        <Badge tone="accent">Elevation</Badge>
        <Badge tone="stop">NIGHT 2</Badge>
      </Section>

      <Section title="Input">
        <div className="w-72">
          <Input placeholder="Route name…" />
        </div>
        <div className="w-72">
          <Input value="Alpenüberquerung" readOnly />
        </div>
      </Section>

      <Section title="Card">
        <Card className="w-64">
          <h3 className="font-medium text-text-hi">Subtle card</h3>
          <p className="mt-1 text-sm text-text-md">On a subtle surface tone.</p>
        </Card>
        <Card raised className="w-64">
          <h3 className="font-medium text-text-hi">Raised card</h3>
          <p className="mt-1 text-sm text-text-md">Elevated with a soft shadow.</p>
        </Card>
      </Section>
    </main>
  );
}
