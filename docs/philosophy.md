# Philosophy

trails.cool is built on a set of principles that guide every decision — from
architecture to product design to how we work.

## Privacy by Design

The Planner collects no personal data. Zero. Sessions are anonymous, there is
no tracking, no analytics on user routes. This isn't just a feature — it's a
commitment rooted in respect for the BRouter and bikerouter.de projects that
inspire trails.cool.

The Journal is equally mindful. All data we collect is documented in a
user-visible **privacy manifest** that is always kept up to date. If it's not
in the manifest, we don't collect it. Users should never be surprised by what
we know about them.

We don't sell data. We don't show ads. We don't build profiles.

## Data Ownership

Your routes and activities are yours. Not ours.

- **Export everything**: Full export of all your data at any time, in open
  formats (GPX, JSON). No lock-in, no "please contact support".
- **Self-host**: Run your own Journal instance and own your data completely.
  Migrate from trails.cool to your own server whenever you want.
- **Documented formats**: Every data entity has clear, public documentation
  of its format so you can build your own tools, visualizations, and
  integrations around your data.
- **Federation**: Your data lives on your instance. When you interact with
  others across instances, your instance stays the canonical source.

## Open Source

trails.cool is MIT licensed. The entire codebase — Planner, Journal, shared
packages, infrastructure — is open source.

This is both a commitment to the open web and an acknowledgment of the
projects that made trails.cool possible:

- [BRouter](https://github.com/abrensch/brouter) — the routing engine
- [bikerouter.de](https://bikerouter.de) — inspiration for the Planner
- [brouter-web](https://github.com/nrenner/brouter-web) — the web client

We benefit from open source. We contribute back to it.

## Open Standards

We build on open standards rather than inventing proprietary ones:

- **GPX** for route and activity interchange
- **ActivityPub** for federation between instances
- **OpenStreetMap** for map data
- **WebFinger** for identity discovery
- **HTTP Signatures** for instance-to-instance trust

When existing standards don't cover our needs, we extend them transparently
(e.g., custom ActivityPub types for route collaboration) and document the
extensions publicly.

## AI-Assisted Development

trails.cool is built with AI. Claude Code and OpenSpec are core tools in our
development workflow. This is an experiment in how far spec-driven, AI-assisted
development can take a real project.

Human contributions are welcome and valued. AI is a tool, not a replacement
for human judgment, design taste, or community input.

The code is the code — regardless of who or what wrote it, it's held to the
same standards of quality, security, and maintainability.

## Internationalization

trails.cool is international from day one. All user-facing strings go through
react-i18next. We start with English and German, and welcome community
contributions for additional languages.

Trails don't have borders. Neither should the tools to explore them.

## Simplicity

We resist complexity. Every feature, every abstraction, every configuration
option must earn its place.

- Start with the simplest thing that works
- Add complexity only when real users need it
- One way to do things is better than two
- If we can delete it and nobody notices, it shouldn't have been there

This applies to architecture (single domain, simple permissions), to product
(no feature creep), and to self-hosting (one Docker Compose file).
