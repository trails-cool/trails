---
name: EAS build credits
description: Avoid unnecessary EAS cloud builds — they consume limited credits
type: feedback
---

Don't trigger EAS builds casually. They consume limited cloud build credits.
**Why:** Free tier has a monthly cap; each `eas build` / `eas build:dev` costs credits.
**How to apply:** Only suggest or run EAS builds when adding/changing native dependencies. JS-only changes don't need a new build — the dev client hot-reloads via the bundler.
