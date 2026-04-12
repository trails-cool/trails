## ADDED Requirements

### Requirement: Unit and component testing with Jest
The mobile app SHALL use Jest + jest-expo + React Native Testing Library for unit and component tests.

#### Scenario: Unit tests run
- **WHEN** `pnpm test` is run in the mobile workspace
- **THEN** Jest executes all `*.test.ts(x)` files with jest-expo preset

#### Scenario: Component rendering tests
- **WHEN** a component test renders a screen with React Native Testing Library
- **THEN** the test can query by accessibility label, text, and testID without a device

### Requirement: E2E testing with Maestro
The mobile app SHALL use Maestro for end-to-end flow testing on real/emulated devices.

#### Scenario: Maestro flow execution
- **WHEN** a Maestro YAML flow is run against a development build
- **THEN** the flow interacts with the app via the accessibility layer (tap, scroll, assert text)

#### Scenario: E2E in CI
- **WHEN** a PR is opened
- **THEN** Maestro E2E flows run against an EAS preview build

### Requirement: No Vitest for mobile
Vitest SHALL NOT be used for the mobile app. React Native Testing Library has incomplete Vitest support — Jest with jest-expo is the stable, Expo-recommended choice.

#### Scenario: Vitest not used
- **WHEN** unit or component tests are added to the mobile app
- **THEN** they use Jest with jest-expo preset, not Vitest
