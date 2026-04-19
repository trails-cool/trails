# mobile-nearby-sync (parked)

OpenSpec change for sharing routes between nearby devices without internet
(BLE-based peer sync + QR-code waypoint fallback) in the mobile app.
Moved here from `openspec/changes/` so it does not clutter the active
change list; revive by moving the directory back under
`openspec/changes/` when ready to implement.

## Status

**Parked.** Blocked on `mobile-app` landing first, and on there being
enough users actually hiking/bikepacking together to justify the BLE
complexity. At the current user count (3) this is engineering for a
hypothetical group trip.

## When to revive

Revisit once **any** of these is true:

- The mobile app is live and users start reporting "we were in a dead zone
  and couldn't update the route"
- A group / tour organiser asks specifically for peer-to-peer route sync
- QR-code waypoint sharing alone (the simpler half of this spec) would
  cover the need — worth shipping that first as a narrower change

## Key constraints to remember

- **Requires an Expo dev build** — `react-native-ble-plx` isn't available
  in Expo Go.
- **iOS + Android BLE APIs differ significantly**; expect platform-specific
  bugs. Background BLE advertising has battery and OS-lifecycle caveats
  (iOS suspends advertising when backgrounded after a grace period).
- **Permissions sprawl**: iOS `NSBluetoothAlwaysUsageDescription`, Android
  `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT` + `BLUETOOTH_ADVERTISE`, plus
  location on older Android.
- **QR waypoint sharing is an order of magnitude simpler** than BLE and
  covers a big chunk of the use case — consider extracting that as a
  separate, earlier change if the need becomes real.

## What's in the folder

- `proposal.md` — why / what / non-goals / impact / future ideas (TXQR)
- `specs/` — delta specs (would land against a new `mobile-nearby-sync` capability)
