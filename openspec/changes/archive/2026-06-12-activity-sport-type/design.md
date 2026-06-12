## Context

`journal.activities` stores `name`, `distance`, `duration`, `elevationGain/Loss`,
`geom`, and provenance via `sync_imports`, but nothing about the *kind* of
activity. The schema already models small closed sets as `text().$type<Union>()`
(see `visibility`, `audience`) rather than `pgEnum`, and imports already parse a
source sport string they currently discard (Komoot `tour.sport`).

## Goals / Non-Goals

**Goals**
- One nullable, normalized sport field, set on create or derived on import.
- Consistent display (badge + feed verb) across detail, feed, and profile.
- Federate the value without a breaking wire change.

**Non-Goals**
- Routes do not get a sport field in this change (their `routingProfile`
  already carries intent; revisit later if needed).
- No per-sport statistics, filtering UI, or sport-specific icons-as-data — this
  change only lands the field and its basic display. Filtering/stats build on
  it later.
- No backfill of historical imports (the column is nullable; old rows read as
  "unspecified"). A one-off backfill can be a follow-up if desired.

## Decisions

### D1: Normalized enum, not passthrough
`SportType = "hike" | "walk" | "run" | "ride" | "gravel" | "mtb" | "ski" | "other"`,
defined as a TS union in `@trails-cool/db` and stored as
`text("sport_type").$type<SportType>()` (nullable). Rationale: a closed set
gives stable icons/verbs/filters and matches the existing schema convention;
passing through raw provider strings would leak Komoot/Garmin taxonomies into
our UI and federation.

### D2: Import normalization
A pure `mapSportType(raw: string): SportType` helper (unit-tested) maps source
strings to the enum, defaulting to `other`:

| Source string (lowercased, normalized) | → |
|---|---|
| `hike`, `mountaineering`, `hiking` | `hike` |
| `walk`, `walking`, `snowshoe` | `walk` |
| `jogging`, `running`, `run` | `run` |
| `racebike`, `touringbicycle`, `citybike`, `e_racebike`, `e_touringbicycle`, `road` | `ride` |
| `gravel`, `gravelbike`, `gravelride` | `gravel` |
| `mountainbike`, `mountainbikeeasy`, `mountainbikeadvanced`, `e_mountainbike`, `mtb` | `mtb` |
| `skitour`, `nordic`, `skatingnordic`, `ski`, `crosscountryski` | `ski` |
| anything else / empty | `other` |

Komoot's `tour.sport` is fed through this on bulk import. Garmin supplies no
sport → the import passes `undefined` (stored NULL).

### D3: Display — a shared `SportBadge`
A small presentational component (icon + i18n label) rendered next to the
activity title on the detail page, on feed cards, and in the profile activity
list. When `sportType` is null it renders nothing (and the feed falls back to a
generic verb). The feed verb is derived from the sport via an i18n key
(`journal.activities.sport.verb.<sport>`), e.g. `run → "went for a run"`.
Icons are inline SVG keyed by sport (no new dependency).

### D4: Federation
`activityToNote()` appends one more `PropertyValue` attachment
(`name: "sport", value: <sportType>`) when set — mirroring how `distance-m` /
`duration-s` are already attached. Additive; consumers that ignore it are
unaffected.

### D5: API contract
`sportType` is added as an optional field (`z.enum([...]).optional()`) to the
activity read schema and the create-request schema in
`packages/api/src/activities.ts`. Optional keeps it non-breaking for existing
clients.

## Risks / Trade-offs

- **Enum coverage**: e-bike and city-bike variants fold into `ride`/`mtb`; we
  lose the e-bike distinction. Accepted for simplicity; can split later without
  a breaking change (adding enum members is additive).
- **Clock/taxonomy drift on import**: provider strings evolve; `mapSportType`
  defaults safely to `other` and is the single place to extend.
