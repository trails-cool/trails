## 1. Design Tokens & Typography

- [ ] 1.1 Add CSS custom properties (`:root` vars) for colors, shadows, borders
- [ ] 1.2 Extend Tailwind config with project color tokens and font families
- [ ] 1.3 Add Outfit + Geist Mono fonts (Google Fonts or self-hosted)
- [ ] 1.4 Update base styles: body background, default text color, font-family
- [ ] 1.5 Update elevation gradient colors in ColoredRoute + ElevationChart to use tokens

## 2. Topbar Redesign

- [ ] 2.1 New logo: Waypoint Dot mark SVG (3 dots + route curve) + "trails .cool" wordmark (Outfit 700/300)
- [ ] 2.1b Generate favicon from Waypoint Dot mark (16px, 32px, 180px apple-touch)
- [ ] 2.2 Replace color mode dropdown with segmented toggle (Plain/Elevation/Surface)
- [ ] 2.3 Restyle participant avatars with name labels and Host badge
- [ ] 2.4 Add "+ Invite" button (copies session link to clipboard)
- [ ] 2.5 Restyle profile selector with bike/hike icon
- [ ] 2.6 Move Export GPX to right-aligned position
- [ ] 2.7 Apply token colors to topbar (--bg-raised, --border, etc.)

## 3. Sidebar Redesign

- [ ] 3.1 Add route summary header (route name, distance, ascent, duration)
- [ ] 3.2 Add day breakdown section with "SOON" badge (collapsible, placeholder)
- [ ] 3.3 Nest waypoints inside day sections (expandable/collapsible)
- [ ] 3.4 Style overnight stop waypoints with amber badge
- [ ] 3.5 Add waypoint note display (italic text under waypoint name, placeholder)
- [ ] 3.6 Apply token colors to sidebar (--bg-raised, --text-md, --accent, etc.)

## 4. Map Marker Styling

- [ ] 4.1 Replace blue waypoint markers with olive/dark circles (#4A6B40 accent)
- [ ] 4.2 Add overnight stop marker variant (amber-brown with "NIGHT N" badge)
- [ ] 4.3 Update ghost marker color to match accent
- [ ] 4.4 Update no-go area colors to use --nogo tokens
- [ ] 4.5 Add day segment labels on route ("Day 1 · 120 km") — placeholder/aspirational

## 5. Elevation Chart Redesign

- [ ] 5.1 Update chart gradient to use --eg-lo / --eg-mid / --eg-hi tokens
- [ ] 5.2 Add day divider vertical dashed lines with labels (aspirational)
- [ ] 5.3 Add min/max elevation labels on Y axis
- [ ] 5.4 Update hover tooltip to show km marker
- [ ] 5.5 Right-align stats display: "343 km distance  ↑ 868 m ascent"

## 6. Mobile Responsive

- [ ] 6.1 Create bottom sheet component (collapsed/half/full states)
- [ ] 6.2 Move sidebar content into bottom sheet on mobile
- [ ] 6.3 Show route summary + mini elevation in collapsed state
- [ ] 6.4 Add swipeable tabs in bottom sheet (Days/Waypoints/Notes)
- [ ] 6.5 Simplify topbar on mobile (hide text labels, compact avatars)
- [ ] 6.6 Test touch interactions (map drag, waypoint tap, sheet swipe)

## 7. Polish

- [ ] 7.1 Add hover/focus states matching design tokens
- [ ] 7.2 Add transitions for sidebar collapse, bottom sheet, tab switches
- [ ] 7.3 Style loading states (connecting, computing route)
- [ ] 7.4 Style empty states (no waypoints, no route)
- [ ] 7.5 Add i18n keys for any new UI text (en + de)
- [ ] 7.6 Visual verification in cmux browser (desktop + mobile viewport)
