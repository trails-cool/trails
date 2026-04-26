# sse-broker Specification

## Purpose
Server-Sent Events (SSE) infrastructure that pushes one-way notifications from the Journal server to the user's open browser tabs in between page navigations. This is the transport layer; specific event payloads (e.g. `notifications.unread`) are owned by the capability that emits them. The interface is intentionally narrow so it can be swapped from the in-process registry to a Redis pub/sub adapter when the Journal goes multi-process, without caller changes.

## Requirements

### Requirement: SSE endpoint exposes a session-bound event stream
The Journal SHALL expose `GET /api/events` returning a streaming `text/event-stream` response that delivers per-user events to a signed-in browser tab. The endpoint SHALL be authenticated via the user's session cookie; anonymous requests SHALL receive HTTP 401 with no event stream. The response SHALL include `Cache-Control: no-cache` and `X-Accel-Buffering: no` so intermediate proxies do not buffer the stream.

#### Scenario: Authenticated client receives an event stream
- **WHEN** a signed-in user opens an `EventSource("/api/events")` connection
- **THEN** the server registers the connection in the broker keyed by the user's id, sends an SSE preamble (including a `retry: 5000` reconnect hint with 0–2 s server-side jitter), and holds the response open until the client disconnects

#### Scenario: Anonymous client is rejected
- **WHEN** an unauthenticated request hits `/api/events`
- **THEN** the server responds with HTTP 401 and does not start a stream

#### Scenario: Heartbeat keeps idle connections alive
- **WHEN** a connection has been open for ≥25 s with no events
- **THEN** the server writes an SSE comment frame (`: ping\n\n`) so intermediate proxies do not idle-timeout the connection
- **AND** if the heartbeat write fails (broken pipe), the connection is removed from the broker registry

#### Scenario: Cleanup on client teardown
- **WHEN** the client closes the EventSource (tab closed, navigation, network drop)
- **THEN** the server removes the connection from the broker on the request's abort signal so subsequent emits to that user don't write to a dead socket

### Requirement: Per-user broker registry with simple emit interface
The Journal SHALL provide a server-side `events.server.ts` module exposing two functions: `register(userId, conn)` returning an unregister callback, and `emitTo(userId, event, data)` that delivers a serialized SSE event to every connection registered for that user. The interface SHALL be the only call site for multi-process swap (in-memory `Map<userId, Set<Connection>>` today; Redis pub/sub later). Generation hooks (e.g. `notifications.server.ts`'s `emitUnreadCount`) SHALL call `emitTo` after their underlying state change commits, never before.

#### Scenario: Emit delivers to all of a user's open connections
- **WHEN** `emitTo("user-1", "notifications.unread", { count: 5 })` is called and "user-1" has two open SSE connections
- **THEN** both connections receive the same SSE frame (`event: notifications.unread\ndata: {"count":5}\n\n`)

#### Scenario: Emit to a user with no open connections is a no-op
- **WHEN** `emitTo("user-2", "notifications.unread", { count: 1 })` is called and "user-2" has zero open connections
- **THEN** the call returns silently without error and without queueing — events are best-effort, the loader-driven count is the source of truth on next render

#### Scenario: Broken connections are pruned defensively
- **WHEN** `emitTo` writes to a connection whose `send` throws (broken pipe)
- **THEN** the broker calls `close()` on that connection so it cannot leak open file descriptors

#### Scenario: Emit happens after the underlying state change commits
- **WHEN** a generation hook (e.g. `createNotification`, `markRead`, `markAllRead`) updates the database
- **THEN** `emitTo` is called only after the transaction commits, so a client receiving the event observes a consistent count when its next request reaches the database

### Requirement: Client hook seeds from loader, then live-updates via SSE
The Journal SHALL provide a React client hook `useUnreadNotifications(initialCount, signedIn)` that opens an `EventSource("/api/events")` when the user is signed in, listens for `notifications.unread` events, and returns the live `count`. The loader-supplied `initialCount` SHALL be the SSR baseline so the badge renders correctly before the first SSE event arrives. The browser's native `EventSource` reconnect behavior SHALL be relied on for transient disconnects; no manual reconnect loop is required.

#### Scenario: Loader baseline rendered on first paint
- **WHEN** a signed-in user navigates to any page
- **THEN** the navbar bell badge initially displays the count returned by the root loader, not zero, even before SSE has handshaked

#### Scenario: Live event overrides the loader baseline
- **WHEN** the server emits `notifications.unread { count: 7 }` to the user's open tab via SSE
- **THEN** the navbar bell badge updates to `7` without a navigation

#### Scenario: Anonymous tab does not open an SSE connection
- **WHEN** a logged-out visitor renders a page
- **THEN** the hook does not call `EventSource("/api/events")` (since the endpoint would 401 anyway)

### Requirement: Caddy reverse-proxy passes SSE through unmodified
The reverse proxy in front of the Journal (Caddy v2) SHALL pass `text/event-stream` responses through without buffering. No special directive is required because Caddy v2 auto-detects the content type and disables response buffering automatically; this requirement exists so future infrastructure changes do not silently re-introduce buffering.

#### Scenario: Caddy reverse_proxy block carries no buffering tweaks
- **WHEN** the Journal upstream is added to `infrastructure/Caddyfile`
- **THEN** the `reverse_proxy journal:3000` entry contains no `flush_interval`, `buffer_requests`, or buffering-related directive
- **AND** unrelated directives that don't affect streaming (e.g. `lb_try_duration` / `lb_try_interval` for retry-on-restart, added to silence deploy-time 502 alerts) are permitted because they only fire when the upstream is unreachable, not on a successful streaming response

### Requirement: In-process today, Redis-pub/sub when multi-process
The broker SHALL be implemented as an in-process `Map` for the single-process deployment shipped today. The same `register` / `emitTo` interface SHALL be the swap point for a future Redis pub/sub adapter when the Journal scales to multiple processes; callers SHALL NOT need to change.

#### Scenario: Single-process deployment
- **WHEN** the Journal runs as one process behind Caddy
- **THEN** the broker is the in-process `Map<userId, Set<Connection>>` and emits resolve synchronously within the same Node process

#### Scenario: Future multi-process swap (forward-compat)
- **WHEN** the Journal is split into multiple processes (e.g., behind a load balancer with sticky sessions or random routing)
- **THEN** `events.server.ts` is rewritten as a Redis pub/sub adapter — `register` subscribes to a per-user channel, `emitTo` publishes — without any change at the call sites
