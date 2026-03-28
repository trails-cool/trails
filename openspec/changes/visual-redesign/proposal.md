## Why

The current UI is functional but unstyled — default Tailwind colors, no visual
identity, no typography system. As features mature (route coloring, no-go areas,
multiplayer), the app needs a design language that matches the quality of the
interactions. Early testers find the tool powerful but visually generic.

A design exploration produced a "Trail Worn warmth + Nordic Precision lightness"
direction: warm off-whites, sage green accent, earthy overnight markers, Outfit
font, Geist Mono for stats. The reference mockup lives at
`mockup.html` (desktop + mobile views).

## What Changes

- **Design system**: CSS custom properties for colors, typography, spacing.
  Tailwind config extended with project tokens. Outfit (body) + Geist Mono
  (stats) fonts.
- **Topbar redesign**: Logo with mountain mark, segmented color mode toggle,
  participant avatars with names, "+ Invite" button, Export GPX right-aligned
- **Sidebar redesign**: Route summary header (name, stats, duration), collapsible
  day breakdown (aspirational, "SOON" badge), waypoints nested inside days,
  overnight badges on stop waypoints, waypoint notes
- **Map marker styling**: Olive/dark numbered circles instead of blue, "NIGHT"
  badges on overnight stops, day segment labels on route
- **Elevation chart**: Day dividers as dashed vertical lines, elevation gradient
  matching route colors, km hover label, min/max elevation labels
- **Mobile responsive**: Bottom sheet pattern replacing hidden sidebar, simplified
  header, swipeable tabs (Days/Waypoints/Notes)

## Capabilities

### New Capabilities

- `design-system`: Shared design tokens, typography, color palette, component
  styling patterns for the Planner app

### Modified Capabilities

- `map-display`: New waypoint marker styling, overnight badges, day labels
- `planner-session`: Sidebar layout with route summary and day breakdown

## Impact

- **Tailwind config**: Extended with project color tokens and font families
- **All Planner components**: Updated styling (colors, typography, spacing)
- **New fonts**: Outfit + Geist Mono loaded via Google Fonts or self-hosted
- **No functional changes**: All existing interactions preserved, only visual
- **ElevationChart**: Canvas drawing updated for new color gradient + day dividers
- **Mobile**: New bottom sheet component for sidebar content
