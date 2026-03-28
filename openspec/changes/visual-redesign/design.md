## Context

The Planner was built function-first with default Tailwind styling. A design
exploration ("D1 warmth + D3 lightness") produced desktop and mobile mockups.
The reference HTML mockup is at `mockup.html`.

## Goals / Non-Goals

**Goals:**
- Implement the visual design from the mockup across all Planner components
- Establish a design token system (CSS vars + Tailwind) for consistency
- Make the Planner mobile-responsive with a bottom sheet sidebar
- Style aspirational features (day breakdown, waypoint notes) as muted/coming-soon

**Non-Goals:**
- Redesigning the Journal app (separate change)
- Implementing multi-day splitting logic (just the visual containers)
- Implementing waypoint notes logic (just the UI placeholders)
- Dark mode (later)
- Landing page redesign (separate)

## Decisions

### D1: Design tokens as CSS custom properties

```css
:root {
  /* Surface */
  --bg:         #F5F2EB;   /* warm off-white, main background */
  --bg-subtle:  #EDEAE1;   /* card backgrounds */
  --bg-raised:  #FAF8F4;   /* topbar, sidebar, elevated surfaces */
  --map-tint:   #E4DFD2;   /* map background tone */

  /* Text */
  --text-hi:    #1A1916;   /* primary */
  --text-md:    #5C5847;   /* secondary labels */
  --text-lo:    #9A9484;   /* tertiary, placeholders */
  --text-inv:   #FAF8F4;   /* on dark surfaces */

  /* Accent: muted sage-forest green */
  --accent:     #4A6B40;
  --accent-dim: #6A8B5E;
  --accent-bg:  rgba(74,107,64,.08);
  --accent-border: rgba(74,107,64,.2);

  /* Overnight stop: warm amber-brown */
  --stop:       #8B6D3A;
  --stop-bg:    rgba(139,109,58,.1);
  --stop-border:rgba(139,109,58,.25);

  /* Danger / no-go */
  --nogo:       rgba(160,60,60,.12);
  --nogo-border:rgba(160,60,60,.3);

  /* UI chrome */
  --border:     #DDD9D0;
  --border-md:  #CAC6BC;
  --shadow-sm:  0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  --shadow-md:  0 4px 12px rgba(0,0,0,.08), 0 1px 4px rgba(0,0,0,.05);

  /* Elevation gradient (route + chart) */
  --eg-lo:   #5A8F46;   /* green, low elevation */
  --eg-mid:  #C4A840;   /* amber, mid elevation */
  --eg-hi:   #C46040;   /* terracotta, high elevation */

  /* Typography */
  --font-body: 'Outfit', sans-serif;
  --font-mono: 'Geist Mono', monospace;
}
```

Extended into Tailwind via `tailwind.config.ts` theme extension so utility
classes work: `text-text-hi`, `bg-bg-raised`, `border-border`, etc.

### D2: Typography & Logo

- **Body**: Outfit (clean, geometric, friendly) — 14px base
- **Stats/distances**: Geist Mono — used for km, elevation, coordinates
- **Logo**: Two-part system:
  - **Mark**: "Waypoint Dot" — three connected dots with a curved route line
    (sage green, SVG). Used as favicon, app icon, and topbar mark.
  - **Wordmark**: "trails" (Outfit 700) + ".cool" (Outfit 300, muted). Used
    alongside the mark in the topbar, standalone for large displays.
  - See `logo-concepts.html` for all sizes (24px, 48px, 128px).
- Loaded via Google Fonts or self-hosted for performance

### D3: Topbar layout

```
┌─────────────────────────────────────────────────────────────┐
│ [∧ trails.cool] │ [🚴 Cycling (safe) ▾] │ [Y] You │ [A][S][M] +3 │ [+ Invite] ││ [Plain │ Elevation │ Surface] │ [↓ Export GPX] │
└─────────────────────────────────────────────────────────────┘
```

- Waypoint Dot mark + "trails .cool" wordmark, separated by vertical divider
- Profile selector with bike icon
- Participant avatars with "You" label and Host badge
- "+ Invite" button (copies session link)
- Segmented toggle for color mode (replaces dropdown)
- Export GPX right-aligned

### D4: Sidebar layout

```
┌─────────────────────────┐
│ [WAYPOINTS] [NOTES]     │
├─────────────────────────┤
│ ACTIVE ROUTE            │
│ Berlin → Erfurt         │
│ via Dessau              │
│ 343 km  ↑868m  3 days  │
├─────────────────────────┤
│ DAY BREAKDOWN [SOON]    │
│ ┌─────────────────────┐ │
│ │ 01  Berlin→Dessau   │ │
│ │     ↑340m    120 km │ │
│ │  ● Berlin Alexplatz │ │
│ │  ○ Zossen           │ │
│ │  ○ Jüterbog         │ │
│ │  ● Dessau OVERNIGHT │ │
│ │    "Elbe crossing"  │ │
│ └─────────────────────┘ │
│ ▸ 02 Dessau→Halle 130km│
│ ▸ 03 Halle→Erfurt  93km│
└─────────────────────────┘
```

- Route summary always visible at top
- Day breakdown collapsible, with waypoints nested inside
- Overnight stops marked with amber badge
- Waypoint notes as italic text under waypoint name
- Day 01 expanded by default, others collapsed

### D5: Map marker styling

- **Waypoint markers**: Dark olive circles (#4A6B40) with white number, not blue
- **Overnight stops**: Amber-brown (#8B6D3A) circle with "NIGHT N" badge above
- **Waypoint notes**: Small note icon on marker, hover/tap to read
- **Day labels**: White pill on route line ("Day 1 · 120 km")
- **No-go areas**: Use `--nogo` / `--nogo-border` tokens (muted red)
- **Ghost marker**: Sage green circle matching accent

### D6: Elevation chart redesign

- Day dividers as dashed vertical lines with "Day 1", "Day 2" labels
- Elevation gradient uses `--eg-lo` → `--eg-mid` → `--eg-hi`
- Min/max elevation labels on Y axis
- Km marker tooltip on hover (not just crosshair)
- Stats right-aligned: "343.3 km distance  ↑ 868 m ascent"

### D7: Mobile bottom sheet

Replace hidden sidebar with a draggable bottom sheet:
- **Collapsed**: Route summary + elevation mini-chart visible
- **Half-expanded**: Tabs (Days/Waypoints/Notes) + scrollable content
- **Full-expanded**: Full sidebar content
- Swipe up/down to toggle states
- Map takes full viewport, sheet overlays from bottom

### D8: Implementation phases

1. **Design tokens + fonts**: CSS vars, Tailwind config, font loading
2. **Topbar**: New layout, segmented toggle, invite button, avatar styling
3. **Sidebar**: Route summary, day breakdown placeholder, waypoint styling
4. **Map markers**: New waypoint icons, overnight badges, ghost marker color
5. **Elevation chart**: New gradient, day dividers, hover label
6. **Mobile**: Bottom sheet component, responsive header
7. **Polish**: Transitions, hover states, loading states, empty states

## Risks / Trade-offs

- **Font loading**: Two Google Fonts add ~40KB. Mitigate with `display=swap`
  and preconnect. Can self-host later.
- **Aspirational features shown as muted**: Users might expect them to work.
  Mitigate with clear "SOON" badges.
- **Custom CSS vars + Tailwind**: Slight complexity. But ensures consistency
  and makes future dark mode straightforward.
- **Bottom sheet on mobile**: Complex to build well. Can use a library like
  `vaul` or build minimal version first.
