## ADDED Requirements

### Requirement: Web Push API on Journal
The Journal SHALL implement the standard Web Push API (RFC 8030) for sending push notifications to subscribed clients.

#### Scenario: Subscribe to push notifications
- **WHEN** a client sends `POST /api/v1/push/subscribe` with a push subscription object (endpoint URL, p256dh key, auth secret)
- **THEN** the Journal stores the subscription and uses it to deliver future notifications for that user

#### Scenario: Receive route update notification
- **WHEN** a shared route is updated by another user
- **THEN** the Journal sends an encrypted Web Push message to all subscribers of that route's owner

#### Scenario: Unsubscribe from push notifications
- **WHEN** a client sends `DELETE /api/v1/push/unsubscribe` with the subscription endpoint URL
- **THEN** the Journal removes the subscription and stops sending notifications to it

### Requirement: Push relay service
A relay service SHALL translate Web Push messages into platform-native push notifications (APNs for iOS, FCM for Android).

#### Scenario: Relay forwards encrypted payload to APNs
- **WHEN** the relay receives a Web Push message destined for an iOS device
- **THEN** the relay forwards the encrypted payload to APNs without decrypting or reading the content

#### Scenario: Relay forwards encrypted payload to FCM
- **WHEN** the relay receives a Web Push message destined for an Android device
- **THEN** the relay forwards the encrypted payload to FCM without decrypting or reading the content

#### Scenario: End-to-end encryption
- **WHEN** a notification is sent from the Journal through the relay to the device
- **THEN** the relay cannot read the notification content — only the mobile app can decrypt it using the subscription keys

### Requirement: Self-hosted relay compatibility
Self-hosted Journal instances SHALL send push notifications through the hosted relay by default, with an option to run a private relay.

#### Scenario: Default relay for self-hosted instances
- **WHEN** a self-hosted Journal instance sends a Web Push notification
- **THEN** it sends the standard Web Push request to the trails.cool hosted relay (no Apple/Google credentials needed on the self-hosted instance)

#### Scenario: Custom relay for self-hosters
- **WHEN** a self-hosted administrator configures a custom relay URL
- **THEN** the Journal sends Web Push requests to the custom relay instead of the hosted one
