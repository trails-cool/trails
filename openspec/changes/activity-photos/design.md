## Context

The Journal stores activities in `journal.activities` with text fields (name,
description, stats) and an optional GPX track. The existing `photos` jsonb
column on activities was a placeholder -- it stores an array of strings but has
no upload pipeline, no storage backend, and no UI.

The architecture plan calls for Garage (S3-compatible, self-hosted) as the
object store. The Garage container is already defined in docker-compose.yml but
commented out. The Journal app has no S3 client code.

Activity detail page (`activities.$id.tsx`) currently shows stats, description,
and route linking -- no photo display.

## Goals / Non-Goals

**Goals:**
- Photo upload on activity pages, stored in S3-compatible storage (Garage)
- Photo gallery display on activity detail page
- Client-side image processing (resize, EXIF strip) before upload
- Presigned URL upload flow (no server proxying)
- Soft delete with S3 cleanup
- Privacy manifest update

**Non-Goals:**
- Video uploads
- GPS-tagged photo placement on route maps
- Photo editing, cropping, or filters
- CDN or edge caching
- Cross-activity photo albums

## Decisions

### D1: Storage -- Garage (S3-compatible, self-hosted)

Enable the existing Garage container in docker-compose.yml. Single bucket
(`activity-photos`) for all photo objects. Keys follow the pattern:

```
{activityId}/{photoId}.webp
```

Garage runs as an internal service -- not exposed to the public internet. The
Journal app generates presigned URLs for both upload (PUT) and download (GET).
This keeps the storage layer behind the application.

Environment variables added to the Journal service:
- `S3_ENDPOINT` -- internal Garage URL (e.g. `http://garage:3900`)
- `S3_ACCESS_KEY` / `S3_SECRET_KEY` -- Garage API credentials
- `S3_BUCKET` -- bucket name (`activity-photos`)
- `S3_PUBLIC_ENDPOINT` -- optional public URL for serving photos (falls back
  to presigned GET URLs if not set)

### D2: Upload flow -- presigned PUT URLs

The client never sends photo bytes to the Journal app server. Flow:

1. Client selects photo(s) and processes them (resize, EXIF strip, convert to
   WebP)
2. Client requests a presigned PUT URL from `POST /api/activities/:id/photos`
   with metadata (filename, content type, dimensions)
3. Server validates the user owns the activity, generates a presigned PUT URL
   (5 min expiry), creates a pending `activity_photos` row, returns the URL
   and photo ID
4. Client uploads directly to Garage using the presigned PUT URL
5. Client confirms upload via `PATCH /api/activities/:id/photos/:photoId` with
   `status: 'uploaded'`
6. Server verifies the object exists in S3 and marks the photo as active

This avoids proxying large files through the Node.js server and keeps the app
server lightweight. Pending photos that are never confirmed are cleaned up by
a periodic check (or on next page load).

### D3: Schema -- `journal.activity_photos` table

```sql
journal.activity_photos (
  id          text PRIMARY KEY,
  activity_id text NOT NULL REFERENCES journal.activities(id) ON DELETE CASCADE,
  s3_key      text NOT NULL,
  alt_text    text,
  width       integer,
  height      integer,
  size_bytes  integer,
  status      text NOT NULL DEFAULT 'pending',  -- 'pending', 'active', 'deleted'
  created_at  timestamptz NOT NULL DEFAULT now()
)
```

The existing `photos` jsonb column on `journal.activities` is superseded by
this table. It can be dropped in a future migration once this feature is stable.

Photos are ordered by `created_at` (upload order). No explicit `position`
column initially -- reordering can be added later if users request it.

### D4: Image processing -- client-side resize and EXIF strip

All image processing happens in the browser before upload:

- **Resize**: Max 2048px on the long edge. Maintains aspect ratio. Uses
  canvas `drawImage` for the resize.
- **Format**: Convert to WebP (broad browser support, good compression). Fall
  back to JPEG for browsers without WebP encode support.
- **EXIF stripping**: Read the image via canvas `drawImage` -- this
  inherently drops EXIF data since canvas does not preserve metadata. This
  removes GPS coordinates, camera info, timestamps, and other metadata that
  users may not want to share.
- **Size limit**: Max 5 MB per photo after processing. The presigned URL has a
  content-length condition enforcing this.

No server-side image processing. This keeps the server simple and avoids
adding Sharp or similar native dependencies.

### D5: Gallery -- grid display with lightbox

Activity detail page shows photos in a responsive grid:

- 1 column on mobile, 2 on tablet, 3 on desktop
- Aspect ratio preserved via `object-cover` in fixed-height cells
- Lazy loading via `loading="lazy"` on `<img>` tags
- Click opens a lightbox overlay with full-size image, left/right navigation,
  close on escape/click-outside
- Alt text shown below image in lightbox (if provided)
- Owner sees an "Add photos" button and delete icons on each photo

The gallery uses presigned GET URLs with 1-hour expiry, generated at page load
time in the loader. For the lightbox, the same URLs are reused (they are valid
long enough for a viewing session).

### D6: Deletion -- soft delete with background cleanup

Deleting a photo sets `status = 'deleted'` in the database. The photo
immediately disappears from the UI. The actual S3 object is cleaned up:

- On the next page load of the activity (loader checks for deleted photos and
  removes them from S3)
- Or by a periodic cleanup that runs on app startup and every 24 hours

This avoids the complexity of a separate job queue while ensuring S3 objects
are eventually cleaned up. The cleanup is idempotent -- deleting a
non-existent S3 key is a no-op.

### D7: Privacy -- manifest and EXIF documentation

Update the privacy page to document:

- **Photo storage**: Photos uploaded to activities are stored in S3-compatible
  object storage (Garage) on the same server as the Journal. Self-hosters
  control their own storage.
- **EXIF stripping**: All photo metadata (GPS coordinates, camera info,
  timestamps) is stripped in the browser before upload. The server never sees
  original EXIF data.
- **Deletion**: Deleted photos are removed from storage. No backups are kept
  beyond what the storage system provides.
- **Data export**: Photos are included in data exports (future).

### D8: Limits -- per-activity and per-photo constraints

- Max **20 photos** per activity. Enforced server-side when generating
  presigned URLs. Client shows remaining count.
- Max **5 MB** per photo (after client-side processing). Enforced via
  presigned URL content-length condition.
- Max **2048px** long edge (client-side resize). Not enforced server-side --
  the 5 MB limit is the hard constraint.
- Supported input formats: JPEG, PNG, WebP, HEIC (converted to WebP on
  client).

## Risks / Trade-offs

- **Garage operational complexity**: Adding another container increases the
  operational surface. Garage is lightweight but needs monitoring. Mitigate by
  adding a Garage health check to the existing Prometheus setup.
- **Client-side processing reliability**: Canvas-based resize may behave
  differently across browsers, especially for HEIC on non-Safari browsers.
  Mitigate by testing on Chrome, Firefox, and Safari, and falling back to
  JPEG if WebP encoding fails.
- **Presigned URL expiry**: If a user's upload takes longer than 5 minutes
  (slow connection, large batch), the presigned URL expires. Mitigate by
  generating URLs one at a time as each upload starts, not all upfront.
- **No server-side validation of image content**: The server trusts that the
  client uploaded a valid image. A malicious user could upload non-image data.
  Mitigate by checking Content-Type on the S3 object during confirmation step
  and adding server-side validation later if abuse occurs.
- **EXIF stripping depends on canvas**: The canvas approach strips EXIF
  reliably but loses all metadata including orientation. The resize step
  handles orientation via `createImageBitmap` with `imageOrientation: 'from-image'`
  before drawing to canvas.
