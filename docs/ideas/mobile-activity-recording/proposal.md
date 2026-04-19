## Why

The mobile app (when built) will show routes and allow editing, but won't record activities. Users want to track their rides/hikes with GPS, see live stats, and save recordings as Journal activities. This is a separate feature that depends on the mobile app foundation being in place first.

## What Changes

- GPS track recording via expo-location (foreground + background)
- Live stats overlay (distance, duration, speed, elevation gain)
- Save recorded track as GPX → Journal activity linked to the active route
- HealthKit (iOS) / Health Connect (Android) export
- Discard/pause/resume recording flow

## Capabilities

### New Capabilities
- `mobile-activity-recording`: GPS recording, live stats, save as activity, health platform export

## Impact

- Depends on `mobile-app` change being implemented first
- New dependencies: expo-location, expo-health
- Background location permissions needed (App Store privacy review)
