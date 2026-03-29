## Why

Activities are text-only. Users complete a hike or bike tour and want to share
photos from the trip alongside their route and stats, but there is no way to
attach images. This is the most basic social feature missing from the Journal --
without it, activities feel like spreadsheet rows rather than trip reports.

The infrastructure for photo storage (Garage, an S3-compatible self-hosted
object store) is already planned and commented out in docker-compose.yml. This
change enables it and builds the upload + display pipeline.

## What Changes

- **Infrastructure**: Enable the Garage container in docker-compose, create a
  bucket for activity photos, add S3 client utility to the Journal app.
- **Schema**: New `journal.activity_photos` table linking photos to activities
  with metadata (S3 key, alt text, dimensions).
- **Upload flow**: Server generates presigned PUT URLs, client uploads directly
  to Garage. Photos are resized and EXIF-stripped on the client before upload.
- **Display**: Photo gallery grid on the activity detail page with lightbox
  view and lazy loading.
- **Deletion**: Soft delete with background S3 cleanup.
- **Privacy**: Photo storage documented in privacy manifest, EXIF stripping
  explained.

## Capabilities

### New Capabilities

- `activity-photos`: Photo upload, storage, gallery display, and deletion on
  Journal activities

### Modified Capabilities

- `infrastructure`: Garage S3 container enabled, bucket provisioned
- `activity-management`: Activity detail page gains photo gallery and upload UI
- `privacy-manifest`: Documents photo storage, EXIF handling, S3 retention

## Non-Goals

- **Video uploads**: Photos only. Video adds transcoding complexity.
- **GPS-tagged photo mapping**: Placing photos on the route map by GPS
  coordinates is a future enhancement, not part of this change.
- **Photo editing or filters**: Upload as-is (after resize and EXIF strip).
- **CDN**: Serve directly from Garage via presigned GET URLs. CDN layer is a
  future optimization.
- **Photo albums or collections**: Photos belong to a single activity. No
  cross-activity albums.
- **Bulk import from external services**: Manual upload only.

## Impact

- **Infrastructure**: Garage container added to docker-compose, new volume for
  object storage, Caddy config for S3 endpoint (internal only)
- **Database**: New `journal.activity_photos` table
- **Dependencies**: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
  for presigned URL generation; client-side image resize library
- **Files**: Activity detail page, new upload component, new gallery component,
  storage server utility, privacy page update
- **Environment variables**: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
  `S3_BUCKET` added to Journal service
- **Privacy**: Photo storage and EXIF handling documented in manifest
