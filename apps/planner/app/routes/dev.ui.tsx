import { useState, type ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  IconButton,
  Input,
  Select,
  SegmentedControl,
} from "@trails-cool/ui";
import { Topbar } from "~/components/Topbar";
import type { Participant } from "~/lib/use-participants";

const SOLO: Participant[] = [
  { clientId: 1, name: "ulle", color: "#4A6B40", isHost: true, isLocal: true },
];
const PARTY: Participant[] = [
  { clientId: 1, name: "ulle", color: "#4A6B40", isHost: true, isLocal: true },
  { clientId: 2, name: "Mara", color: "#8B6D3A", isHost: false, isLocal: false },
  { clientId: 3, name: "Sam", color: "#C46040", isHost: false, isLocal: false },
];

const noop = () => {};
const profilePlaceholder = (
  <Button variant="ghost" size="sm">
    🚴 Cycling
  </Button>
);
const actionsPlaceholder = (
  <Button variant="secondary" size="sm">
    Export GPX
  </Button>
);

function TopbarConfig({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-text-md">{caption}</p>
      <div className="overflow-hidden rounded-lg border border-border">
        {children}
      </div>
    </div>
  );
}

const UndoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);
const RedoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
  </svg>
);

const COLOR_MODES = [
  { value: "plain", label: "Plain" },
  { value: "elevation", label: "Elevation" },
  { value: "surface", label: "Surface" },
] as const;

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
  const [colorMode, setColorMode] =
    useState<(typeof COLOR_MODES)[number]["value"]>("elevation");

  return (
    <main className="h-dvh overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-10 p-10">
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

      <Section title="Select">
        <Select defaultValue="fastbike" size="sm" aria-label="Profile (sm)">
          <option value="fastbike">Radfahren (schnell)</option>
          <option value="trekking">Trekking</option>
          <option value="car">Auto</option>
        </Select>
        <Select defaultValue="trekking" aria-label="Profile (md)">
          <option value="fastbike">Radfahren (schnell)</option>
          <option value="trekking">Trekking</option>
          <option value="car">Auto</option>
        </Select>
      </Section>

      <Section title="IconButton">
        <IconButton label="Undo">
          <UndoIcon />
        </IconButton>
        <IconButton label="Redo">
          <RedoIcon />
        </IconButton>
        <IconButton label="Undo (disabled)" disabled>
          <UndoIcon />
        </IconButton>
        <IconButton label="Undo" variant="secondary">
          <UndoIcon />
        </IconButton>
      </Section>

      <Section title="SegmentedControl · color mode">
        <SegmentedControl
          options={COLOR_MODES}
          value={colorMode}
          onChange={setColorMode}
          label="Color mode"
        />
        <span className="text-sm text-text-md">
          selected: <code className="font-mono">{colorMode}</code>
        </span>
      </Section>

      <Section title="Avatar · participants">
        <Avatar name="ulle" color="#4A6B40" />
        <Avatar name="Mara" color="#8B6D3A" />
        <Avatar name="Sam" color="#C46040" />
        <Avatar name="ulle" color="#4A6B40" size="sm" />
        <span className="inline-flex items-center gap-1.5 text-sm text-text-hi">
          <Avatar name="ulle" color="#4A6B40" size="sm" />
          ulle
          <Badge tone="accent">Host</Badge>
        </span>
      </Section>

      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-text-lo">
          Topbar · configurations
        </h2>
        <TopbarConfig caption="Solo · connected · host">
          <Topbar
            participants={SOLO}
            connected
            sessionShortId="a83eddb4"
            canUndo={false}
            canRedo={false}
            onUndo={noop}
            onRedo={noop}
            profileSlot={profilePlaceholder}
            actions={actionsPlaceholder}
          />
        </TopbarConfig>
        <TopbarConfig caption="Multiplayer · connected · undo available">
          <Topbar
            participants={PARTY}
            connected
            sessionShortId="a83eddb4"
            canUndo
            canRedo={false}
            onUndo={noop}
            onRedo={noop}
            profileSlot={profilePlaceholder}
            actions={actionsPlaceholder}
          />
        </TopbarConfig>
        <TopbarConfig caption="Guest · connecting (offline dot)">
          <Topbar
            participants={PARTY.slice(1)}
            connected={false}
            sessionShortId="a83eddb4"
            canUndo={false}
            canRedo={false}
            onUndo={noop}
            onRedo={noop}
            profileSlot={profilePlaceholder}
            actions={actionsPlaceholder}
          />
        </TopbarConfig>
      </section>

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
      </div>
    </main>
  );
}
