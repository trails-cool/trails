# trails.cool has moved

This repository is no longer the home of trails.cool. Development moved to a
self-hosted [Forgejo](https://forgejo.org) instance:

### ➡️ **https://git.ullrich.is/trails-cool/trails**

Code, issues, pull requests, CI/CD and releases all live there now. This GitHub
repository is a historical archive and receives no further updates.

## Clone the new location

```bash
git clone https://git.ullrich.is/trails-cool/trails.git
```

Already have a clone of this repository? Just repoint it — the full history came
across unchanged, so your local commits and branches stay valid:

```bash
git remote set-url origin https://git.ullrich.is/trails-cool/trails.git
git fetch origin
```

## What is trails.cool?

A federated, self-hostable platform for outdoor enthusiasts, built as two apps:

- **Planner** — a stateless, collaborative route editor. Real-time editing via
  Yjs, routing via BRouter, no accounts, sessions are anonymous and ephemeral.
- **Journal** — a federated social platform for routes and activities, speaking
  ActivityPub so instances can follow each other.

Privacy-first by design: the Planner collects no user data, and everything you
put into the Journal is exportable in open formats (GPX, JSON). Documentation,
architecture notes and the roadmap are all in the new repository.

---

<sub>This branch intentionally has no shared history with the archived code — it
exists only to point the way. The code itself, with its full history, is at the
link above.</sub>
