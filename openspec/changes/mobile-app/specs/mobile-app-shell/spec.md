## ADDED Requirements

### Requirement: Expo app scaffold
The system SHALL provide a React Native + Expo managed workflow app at `apps/mobile/` in the monorepo, sharing workspace packages.

#### Scenario: App boots on iOS and Android
- **WHEN** the app is launched on iOS or Android
- **THEN** the Expo managed app loads, displays the tab navigation, and renders the Map tab by default

#### Scenario: Monorepo integration
- **WHEN** the mobile app is built
- **THEN** it resolves `@trails-cool/types`, `@trails-cool/gpx`, and `@trails-cool/i18n` from pnpm workspace dependencies

### Requirement: Tab navigation
The system SHALL provide a bottom tab bar with four tabs: Map, Routes, Activities, and Profile.

#### Scenario: Tab switching
- **WHEN** the user taps a tab (Map, Routes, Activities, or Profile)
- **THEN** the corresponding screen is displayed and the active tab is visually highlighted

#### Scenario: Tab state preservation
- **WHEN** the user switches between tabs
- **THEN** each tab preserves its scroll position and navigation stack

### Requirement: Authentication flow
The system SHALL require Journal account authentication before accessing protected screens.

#### Scenario: First launch
- **WHEN** the user opens the app for the first time
- **THEN** a login screen is shown with the option to enter their Journal instance URL and authenticate

#### Scenario: Session persistence
- **WHEN** the user has previously authenticated and reopens the app
- **THEN** stored tokens are loaded from SecureStore and the user is logged in automatically

### Requirement: Deep linking
The system SHALL handle deep links for opening routes and activities.

#### Scenario: Open route via deep link
- **WHEN** the app receives a deep link like `trailscool://routes/:id`
- **THEN** the app navigates to the route detail screen for that route

#### Scenario: Open Planner for collaborative editing
- **WHEN** the user taps "Edit in Planner" on a route
- **THEN** the system opens the Planner web URL in the device browser with the appropriate session callback
