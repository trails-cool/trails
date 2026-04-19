## Why

When bikepacking or hiking in a group, one person may update the route at the last café with WiFi. Once the group is in the middle of nowhere with no signal, the others are stuck with the old route. There's no way to share route updates between nearby devices without internet.

## What Changes

- **BLE route sync**: Devices discover each other via Bluetooth LE and transfer route data (waypoints + GPX geometry) directly. Uses react-native-ble-plx for cross-platform iOS ↔ Android compatibility.
- **QR waypoint sharing** (v1, simpler): Generate a QR code with compressed waypoint coordinates. The receiver scans it and gets the waypoints immediately — full route geometry recomputes when signal returns.
- **Sync protocol**: A lightweight protocol over BLE that handles discovery ("who nearby has this route?"), versioning ("is your copy newer than mine?"), and transfer (chunked GPX data).

## Capabilities

### New Capabilities
- `mobile-nearby-sync`: BLE-based route sync between nearby devices, QR waypoint sharing fallback

## Non-Goals
- Real-time collaborative editing over BLE (too complex — this is one-shot sync)
- Syncing activities or other data (routes only for v1)
- Mesh networking (direct device-to-device only, no relay through third devices)

## Impact

- Depends on `mobile-app` change being implemented first
- New dependency: react-native-ble-plx (requires Expo dev build)
- BLE background advertising needs careful battery management
- iOS requires Bluetooth usage description in Info.plist
- Android requires BLUETOOTH_SCAN, BLUETOOTH_CONNECT, BLUETOOTH_ADVERTISE permissions

## Future ideas
- TXQR (animated QR codes via camera) as an alternative transfer method — ~13KB/s demonstrated, no pairing needed, but requires porting the fountain code protocol to TypeScript
