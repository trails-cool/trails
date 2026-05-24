## Purpose

Round-trip GPX exchange between Planner and Journal so a Journal user can open a saved route in the Planner, edit it collaboratively, and save it back as a new version — without the Planner ever holding user credentials.

## Actors

- **Journal** — authenticated web app; owns routes, issues tokens, hosts the callback endpoint.
- **Planner** — stateless collaborative editor; receives initial route data; posts the result back.
- **User's browser** — navigates between the two apps via a redirect URL.

---

## Flow overview

```
Journal (POST /api/routes/:id/edit-in-planner)
  → Planner (POST /api/sessions)          [server-to-server]
  ← { sessionId, url, initialWaypoints, initialNoGoAreas, initialNotes }
  → Browser redirect to /session/:id?waypoints=…&notes=…&returnUrl=…
  → User edits route
  → SaveToJournalButton (POST callbackUrl, Bearer token, { gpx })   [browser-to-Journal]
  ← { success: true }
  → "Return to Journal" link shown
```

---

## Requirements

### Requirement: Journal initiates the handoff

When a Journal user triggers "Edit in Planner", the Journal action (`POST /api/routes/:id/edit-in-planner`) MUST:

1. Authenticate the requesting user via the Journal session. Return 401 if unauthenticated.
2. Load the route and verify the requesting user is the route owner. Return 403 otherwise.
3. Issue a JWT callback token scoped to that route (see Token section).
4. Construct `callbackUrl = <journalOrigin>/api/routes/:id/callback`.
5. POST to `<PLANNER_URL>/api/sessions` with JSON body:
   ```json
   {
     "callbackUrl": "<journalOrigin>/api/routes/:id/callback",
     "callbackToken": "<jwt>",
     "gpx": "<gpx string or omitted if route has no GPX>"
   }
   ```
6. Parse the Planner session response to obtain `{ sessionId, url, initialWaypoints, initialNoGoAreas, initialNotes }`.
7. Build a redirect URL: `<PLANNER_URL><session.url>?returnUrl=<journalRouteUrl>[&waypoints=…][&noGoAreas=…][&notes=…]`. Only include the optional params when the Planner returned non-empty values for them.
8. Return `{ url: "<redirect url>" }` to the browser.

The Journal MUST return 502 if the Planner session creation request fails.

#### Scenario: Successful handoff initiation
- **WHEN** an authenticated route owner clicks "Edit in Planner"
- **THEN** the Journal POSTs to the Planner's `/api/sessions`, receives a session URL, and returns a redirect URL to the browser

#### Scenario: Unauthenticated user
- **WHEN** an unauthenticated user triggers the edit-in-planner action
- **THEN** the Journal returns 401

---

### Requirement: Planner creates a session

`POST /api/sessions` MUST:

1. Accept `callbackUrl`, `callbackToken`, and `gpx` from the JSON body. All three are optional; the Planner can also be used without a Journal connection.
2. Create a new session row (UUID) in the `planner.sessions` table, storing `callbackUrl` and `callbackToken` verbatim.
3. If `gpx` is provided, parse it with `@trails-cool/gpx`:
   - Extract waypoints → `initialWaypoints` (omitted if empty).
   - Extract no-go areas → `initialNoGoAreas` (omitted if empty).
   - Extract `gpxData.description` → `initialNotes` (omitted if absent).
   - If GPX parsing throws, silently ignore and continue with an empty session.
4. Return HTTP 201:
   ```json
   {
     "sessionId": "<uuid>",
     "url": "/session/<uuid>",
     "initialWaypoints": […],
     "initialNoGoAreas": […],
     "initialNotes": "<string>"
   }
   ```
   Omit `initialWaypoints`, `initialNoGoAreas`, and `initialNotes` when absent.

#### Scenario: Session created with GPX
- **WHEN** the Journal POSTs a valid GPX string to `/api/sessions`
- **THEN** the Planner parses waypoints, no-go areas, and notes and returns them in the 201 response

#### Scenario: Invalid GPX silently ignored
- **WHEN** the Journal POSTs a malformed GPX string
- **THEN** the Planner creates an empty session and returns HTTP 201 with no initial planning data

---

### Requirement: Planner session page initialises route data

`GET /session/:id` (server loader) MUST:

1. Look up the session by ID. Return 404 if not found or already closed.
2. Expose `callbackUrl` and `callbackToken` to the client component (from the session row).

The client component MUST read the following URL search params from the redirect URL the Journal built:

| Param | Type | Purpose |
|---|---|---|
| `waypoints` | JSON array | Initial waypoint list |
| `noGoAreas` | JSON array | Initial no-go polygon list |
| `notes` | string | Initial route notes |
| `returnUrl` | string | "Return to Journal" link target |

On first Yjs sync (`synced` event), if the Yjs document is empty the client populates:
- `doc.getArray("waypoints")` from `initialWaypoints`
- `doc.getArray("noGoAreas")` from `initialNoGoAreas`
- `doc.getText("notes")` from `initialNotes`

Population is gated on `waypoints.length === 0` to avoid duplicating data on reconnect.

The `callbackUrl`, `callbackToken`, and `returnUrl` are passed as props to `SessionView` → `SaveToJournalButton`. They are **not** stored in the Yjs document.

#### Scenario: Session page loads with route data
- **WHEN** a browser navigates to `/session/:id?waypoints=…&notes=…&returnUrl=…`
- **THEN** on first Yjs sync the document is populated with the provided waypoints and notes

#### Scenario: Reconnect does not duplicate data
- **WHEN** the Yjs WebSocket reconnects and fires `synced` again
- **THEN** the initialization guard prevents re-inserting the initial data

---

### Requirement: Planner saves the route back to the Journal

`SaveToJournalButton` MUST:

1. Only render when both `callbackUrl` and `callbackToken` are present.
2. On activation, read the current Yjs state:
   - Waypoints from `doc.getArray("waypoints")`.
   - Computed track geometry (GeoJSON) from `doc.getMap("routeData").get("geojson")` — this is the BRouter output stored by the routing client.
   - No-go areas from `doc.getArray("noGoAreas")`.
   - Notes text from `doc.getText("notes").toString()`.
3. Generate a GPX string via `generateGpx({ name: "trails.cool route", description: notes, waypoints, tracks, noGoAreas })`.
   - Notes round-trip as the GPX `<metadata><desc>` element.
   - No-go areas are embedded as GPX extensions on the track.
4. POST to `callbackUrl`:
   ```
   POST <callbackUrl>
   Authorization: Bearer <callbackToken>
   Content-Type: application/json

   { "gpx": "<gpx string>" }
   ```
5. On success, show a "saved" confirmation and a "Return to Journal" link targeting `returnUrl`.
6. On failure, surface the error message from the response body.

#### Scenario: Save to Journal
- **WHEN** a user clicks "Save to Journal"
- **THEN** the Planner generates GPX from the current Yjs state and POSTs it to the callback URL with the Bearer token

---

### Requirement: Journal callback endpoint writes a new version

`POST /api/routes/:id/callback` MUST:

1. Respond to CORS preflight (`OPTIONS`) with:
   - `Access-Control-Allow-Origin: <PLANNER_URL>`
   - `Access-Control-Allow-Methods: POST, OPTIONS`
   - `Access-Control-Allow-Headers: Content-Type, Authorization`
2. Require a `Bearer <token>` in the `Authorization` header. Return 401 if absent.
3. Verify the JWT (HS256, issuer = Journal origin). Return 401 on verification failure.
4. Confirm the token's `route_id` claim matches `:id`. Return 403 if not.
5. Confirm the token's `permissions` array includes `"write"`. Return 403 if not.
6. Confirm the route exists. Return 404 if not.
7. Parse `{ gpx }` from the JSON request body. Return 400 if absent.
8. Call `updateRoute(routeId, ownerId, { gpx })`, which creates a new route version. Return 400 if GPX validation fails (`GpxValidationError`).
9. Return `{ success: true, routeId }` on success.

All responses include CORS headers so the browser can read them.

#### Scenario: Valid callback saves new version
- **WHEN** the Planner POSTs a valid GPX with a valid Bearer token to the callback endpoint
- **THEN** the Journal writes a new route version and returns `{ success: true }`

#### Scenario: Expired or tampered token
- **WHEN** the JWT is expired or the signature is invalid
- **THEN** the Journal returns HTTP 401

---

### Requirement: JWT callback token

The Journal SHALL issue HS256 JWTs signed with `JWT_SECRET` (env var; defaults to `"dev-jwt-secret-change-in-production"` in development).

| Claim | Value |
|---|---|
| `iss` | Journal origin URL |
| `iat` | Issue time |
| `exp` | Issue time + 7 days |
| `route_id` | Route ID string |
| `permissions` | `["read", "write"]` |

The Planner stores the token opaquely in the `planner.sessions` table and presents it verbatim in the `Authorization: Bearer` header on callback. The Planner never inspects the token contents.

#### Scenario: Token claims verified on callback
- **WHEN** the callback endpoint receives a request
- **THEN** it verifies the HS256 signature, checks `route_id` matches the URL param, and confirms `permissions` includes `"write"`

---

## Notes flow (round-trip)

```
Journal route.description
  → GPX <metadata><desc> (via Journal's stored GPX)
  → Planner POST /api/sessions body.gpx
  → parse: gpxData.description → initialNotes
  → URL param ?notes=<string>
  → Yjs doc.getText("notes")
  → generateGpx({ description: notes })
  → GPX <metadata><desc>
  → Journal callback body.gpx
  → updateRoute stores new GPX version
```

Notes are plain text. No Markdown processing occurs in the handoff layer.

---

## Session lifecycle

Sessions are stored in `planner.sessions` (PostgreSQL). A session is considered active while `closed = false`. The session expiry job removes rows older than 7 days (configurable). Closing a session (`closed = true`) also removes its in-memory Yjs document. There is no automatic session close triggered by saving back to the Journal; the session remains open and the user can continue editing and save again.

---

## Scenarios

### Scenario: Full round-trip with notes and no-go areas

- **GIVEN** a Journal route with GPX containing waypoints, a computed track, no-go area extensions, and a `<metadata><desc>` with notes text
- **WHEN** the owner clicks "Edit in Planner"
- **THEN** the Journal POSTs to `/api/sessions` with the full GPX
- **AND** the Planner parses waypoints, no-go areas, and notes from the GPX
- **AND** the browser is redirected to `/session/:id?waypoints=…&noGoAreas=…&notes=…&returnUrl=…`
- **AND** on first sync the Yjs document is populated with all three data types
- **WHEN** the user edits the route and clicks "Save to Journal"
- **THEN** the Planner generates GPX embedding the current waypoints, computed track, no-go areas, and notes in `<metadata><desc>`
- **AND** POSTs it to `callbackUrl` with the JWT in `Authorization: Bearer`
- **AND** the Journal verifies the token, writes a new route version, and returns `{ success: true }`
- **AND** the "Return to Journal" link is shown

### Scenario: Route without GPX

- **GIVEN** a Journal route with no stored GPX
- **WHEN** the owner clicks "Edit in Planner"
- **THEN** the Journal omits the `gpx` field from the `/api/sessions` POST body
- **AND** the Planner creates an empty session and returns no `initialWaypoints`, `initialNoGoAreas`, or `initialNotes`
- **AND** the browser is redirected to `/session/:id?returnUrl=…` with no planning data params
- **AND** the Yjs document starts empty

### Scenario: Invalid GPX in session creation

- **GIVEN** the Journal sends a malformed GPX string
- **WHEN** the Planner's `POST /api/sessions` handler attempts to parse it
- **THEN** the parse error is silently swallowed
- **AND** the session is created with no initial planning data
- **AND** HTTP 201 is returned as normal

### Scenario: Expired or tampered token on callback

- **GIVEN** the JWT is expired or the signature is invalid
- **WHEN** the Planner POSTs to the callback endpoint
- **THEN** `verifyRouteToken` throws
- **AND** the Journal returns HTTP 401 with `{ error: "<message>" }`

### Scenario: Reconnect does not duplicate data

- **GIVEN** a session that was already populated and has an active Yjs document
- **WHEN** the Yjs WebSocket reconnects and fires `synced` again
- **THEN** the initialization guard (`waypoints.length === 0 && !initializedWaypoints.current`) prevents re-inserting the initial data
