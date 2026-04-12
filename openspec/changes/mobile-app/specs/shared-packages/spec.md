## MODIFIED Requirements

### Requirement: React Native compatibility for types package
The `@trails-cool/types` package SHALL work in React Native without modification.

#### Scenario: Types import in mobile app
- **WHEN** the mobile app imports interfaces from `@trails-cool/types`
- **THEN** all types resolve correctly with no DOM or Node.js API dependencies

### Requirement: React Native compatibility for gpx package
The `@trails-cool/gpx` package SHALL work in React Native by using a platform-appropriate XML parser.

#### Scenario: GPX parsing on mobile
- **WHEN** the mobile app calls `parseGpx()` with a GPX string
- **THEN** the package uses the React Native runtime's DOMParser (or a polyfill) instead of `linkedom`, and returns the same typed output as on Node.js

#### Scenario: GPX generation on mobile
- **WHEN** the mobile app calls `generateGpx()` with route data
- **THEN** the package produces valid GPX XML without relying on Node.js APIs

### Requirement: React Native compatibility for i18n package
The `@trails-cool/i18n` package SHALL work in React Native with the same translation files.

#### Scenario: i18n initialization on mobile
- **WHEN** the mobile app initializes i18n using `@trails-cool/i18n`
- **THEN** translations load correctly and `useTranslation()` works in React Native components

#### Scenario: Language switching
- **WHEN** the user changes language in the mobile app's Profile tab
- **THEN** all strings update to the selected language using the shared translation files
