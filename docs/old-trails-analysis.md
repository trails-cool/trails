# Feature Analysis: /Users/ullrich/Projects/trails

Analysis of the older trails Remix app for features and patterns that could be
ported or adapted for trails-cool. Organized by category with implementation
references.

## Social Features

### Reactions/Kudos System
Allow users to react to activities with configurable reaction types (currently
"kudos"). Generic implementation supports any target type (profile, activity,
etc.). UI shows reaction counts on activity cards.

- `drizzle/models/social-interactions.ts`
- `app/routes/api+/activities.$activityId.reactions.ts`

### Comments/Replies
Thread-based comment system on activities. Comments stored as social
interactions with "reply" kind. Shows reply counts alongside reactions.

- `app/routes/api+/activities.$activityId.replies.ts`
- `app/routes/feed.tsx`

### User Following
Follow/unfollow user profiles with mutual follow tracking and uniqueness
constraints. Can be extended to follow specific routes or activities.

- `app/routes/api+/follows.ts`
- `app/utils/social.server.ts`

### Personalized Activity Feed
Feed showing activities from followed users, filtered by visibility (public,
followers-only, private). Shows interaction counts (reactions, replies).

- `app/routes/feed.tsx`
- `app/utils/social.server.ts`

## Import & Integration

### Activity Import from External Services
Komoot integration for importing tours. Batch import tracking with status
(queued, running, completed, failed). Automatic deduplication using dedupeKey
prevents duplicate imports. Detailed statistics (totalFound, importedCount,
duplicateCount).

- `app/inngest/importActivities.ts`
- `app/utils/integrations.server.ts`

### Third-Party Sync Jobs
Background Inngest jobs for syncing external platforms. Handles credential
validation and error recovery. Tracks lastSyncedAt for incremental syncing.

- `app/inngest/komootSync.ts`

### Integration Connections Management
Store encrypted credentials for multiple service integrations. Track connection
status and last sync time. Support for multiple users connecting the same
integration independently.

- `app/routes/integrations.tsx`
- `app/routes/api+/integrations.ts`

## Route Planning

### Ride Plan Scheduling
Schedule rides with timezone-aware start/end times. Privacy levels
(followers-only, private, public). Group ride flag for collaborative planning.

- `drizzle/models/ride-plans.ts`

### Route Geometry Encoding
Encoded polyline storage for efficient geometry. Route metrics: distance,
elevation gain, origin, destination. Multiple routes per ride plan.

- `drizzle/models/ride-routes.ts`
- `app/components/ride-plans/route-editor.tsx`

### Ride Plan Participants
Invite users to group rides. Track participation status (invited, accepted,
declined). Enables collaborative ride planning.

- `drizzle/models/ride-plan-participants.ts`

## Activity Tracking

### Live Activity Recording
Start/pause/finish live recordings. Records start time, end time, duration,
distance, elevation gain. Manual form completion for recorded activities.
Activity status tracking (recording, paused, completed).

- `app/components/activities/activity-recorder.tsx`
- `app/routes/api+/activities.recordings.start.ts`

### Activity Visibility Levels
Public, followers-only, and private visibility options. Source tracking (native
recording vs. import). Link activities to specific ride plans and routes.

- `drizzle/models/ride-activities.ts`

## User Profile & Content

### Profile Images
S3-compatible storage for profile pictures. Signed PUT requests for direct
client uploads. Image serving via openimg library for optimization.

- `app/utils/storage.server.ts`
- `drizzle/models/user-images.ts`

### User Notes/Blog
Rich note creation with title and markdown content. Image attachments to notes
(up to 5 images per note). Note listing and detail views. Image form validation
(3MB max per file).

- `drizzle/models/notes.ts`
- `app/routes/users+/$username_+/notes.tsx`

### Note Images
Upload and manage images within notes. Alt text support for accessibility. S3
storage with organized paths.

- `drizzle/models/note-images.ts`
- `app/routes/users+/$username_+/__note-editor.tsx`

## Search & Discovery

### User Search
Full-text search over username and display name. Pagination with limit of 50
results. Search results with profile images. Case-insensitive matching.

- `app/routes/users+/index.tsx`

### Search Bar Component
Debounced auto-submit search. Reusable search UI component. Query parameter
preservation.

- `app/components/search-bar.tsx`

## Authentication & Settings

### Two-Factor Authentication
TOTP-based 2FA on top of passkeys. Settings UI for enabling/disabling.
Verification flow.

- `app/routes/settings+/profile.two-factor.tsx`

### Email Verification
Email-based account verification. Verification token tracking. Email change
flow with verification.

- `drizzle/models/verifications.ts`

### Profile Management
Change email, password, name. Photo upload. Passkey management. Connected
OAuth providers (GitHub).

- `app/routes/settings+/profile.tsx`

## Federation

### ActivityPub Foundation
Inbox/outbox endpoints for federated social network. Background publishing via
Inngest. Federation record tracking for local/federated entity mapping.

- `app/routes/api+/activitypub.inbox.ts`
- `app/routes/api+/activitypub.outbox.ts`

## Data Management

### Activity Files Association
Attach files/media to activities. Track file metadata and relationships.

- `drizzle/models/activity-files.ts`

### Import Batch Tracking
Comprehensive import job tracking. Status lifecycle: queued, running,
completed, failed. Timing and statistics per batch. Progress monitoring in UI.

- `drizzle/models/import-batches.ts`

## Architectural Patterns

### Role-Based Access Control
User roles and permission system. Basis for admin controls. Permission groups
for feature access.

- `drizzle/models/roles.ts`
- `drizzle/models/permissions.ts`

### Background Job Queue (Inngest)
Event-driven async processing. Reliable job retry with exponential backoff.
Step-based workflow for complex operations. Progress monitoring and error
handling.

- `app/inngest/`

### Deduplication Strategy
Unique composite keys (ownerId + dedupeKey) for imports. onConflictDoNothing
pattern prevents duplicates. Useful for imports from multiple sources.

- `drizzle/models/ride-activities.ts`

## UX/Component Patterns

### Status Button
Button that displays async operation states (idle, pending, success, error).
Useful for form submissions and API calls.

- `app/components/ui/status-button.tsx`

### Form Validation (Conform + Zod)
Client/server validation with Conform.js and Zod. Constraint generation from
schemas. Field error display and form recovery.

- `app/components/forms.tsx`

## Priority Suggestions for trails-cool

**High (directly applicable):**
- Reactions/Kudos — simple engagement, minimal schema
- Comments — essential social feature
- Following — core for Phase 2 federation
- Live Activity Recording — core outdoor feature
- User Search — discovery

**Medium (enhances existing):**
- Profile images — user experience
- Activity visibility levels — privacy controls
- Import from Komoot/Strava — integration value
- Ride plan participants — collaborative planning

**Lower (future):**
- Notes/Blog — content creation
- 2FA — security hardening
- Role-based access — admin features
- Background jobs (Inngest pattern) — already have infra for it
