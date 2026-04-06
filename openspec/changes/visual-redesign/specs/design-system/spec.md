## ADDED Requirements

### Requirement: Design token system
The Planner SHALL use CSS custom properties for colors, typography, and spacing with Tailwind config extensions.

#### Scenario: Consistent styling
- **WHEN** a component is styled
- **THEN** it uses project design tokens (warm off-whites, sage green accent, earthy tones) via Tailwind classes

#### Scenario: Typography
- **WHEN** text is rendered
- **THEN** body text uses Outfit font and statistics use Geist Mono

### Requirement: Redesigned topbar
The Planner topbar SHALL include a logo, segmented color mode toggle, participant avatars, and export controls.

#### Scenario: Topbar layout
- **WHEN** a user is in a planning session
- **THEN** the topbar shows: logo with mountain mark, color mode toggle, participant avatars with names, and Export GPX button

### Requirement: Redesigned sidebar
The Planner sidebar SHALL display a route summary header with stats, collapsible day breakdown, and waypoints nested inside days.

#### Scenario: Route summary
- **WHEN** a route is computed
- **THEN** the sidebar header shows route name, distance, ascent, and estimated duration

### Requirement: Redesigned map markers
Map waypoint markers SHALL use olive/dark numbered circles with overnight badges on stop waypoints.

#### Scenario: Marker styling
- **WHEN** waypoints are displayed on the map
- **THEN** they appear as dark numbered circles instead of default blue markers

### Requirement: Mobile responsive layout
The Planner SHALL use a bottom sheet pattern on mobile instead of a hidden sidebar.

#### Scenario: Mobile view
- **WHEN** the Planner is viewed on a mobile device
- **THEN** a bottom sheet replaces the sidebar with swipeable tabs (Days/Waypoints/Notes)
