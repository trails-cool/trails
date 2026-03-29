## 1. Infrastructure

- [ ] 1.1 Enable Garage container in `infrastructure/docker-compose.yml`: uncomment the existing service, add `garage_data` volume, add health check, add `garage.toml` config file with single-node setup
- [ ] 1.2 Create `activity-photos` bucket in Garage: add an init script or document the `garage bucket create` command, generate API key with read/write access to the bucket
- [ ] 1.3 Add S3 environment variables to Journal service in docker-compose: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_ENDPOINT`

## 2. S3 Client & Server Utilities

- [ ] 2.1 Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` dependencies to the Journal app
- [ ] 2.2 Create `apps/journal/app/lib/storage.server.ts`: S3 client singleton, `generateUploadUrl(key, contentType, maxBytes)`, `generateDownloadUrl(key, expiresIn)`, `deleteObject(key)`, `headObject(key)` functions
- [ ] 2.3 Add env validation for S3 variables in Journal app startup (fail loudly if missing when photo feature is used)

## 3. Database Schema

- [ ] 3.1 Add `activityPhotos` table to `packages/db/src/schema/journal.ts`: id, activityId (FK to activities, cascade delete), s3Key, altText, width, height, sizeBytes, status (pending/active/deleted), createdAt
- [ ] 3.2 Push schema with `pnpm db:push` and verify table exists in local PostgreSQL

## 4. Upload API

- [ ] 4.1 Create `apps/journal/app/routes/api.activities.$id.photos.ts`: POST handler that validates ownership, checks photo count limit (max 20), generates presigned PUT URL, creates pending `activity_photos` row, returns URL + photo ID
- [ ] 4.2 Create `apps/journal/app/routes/api.activities.$id.photos.$photoId.ts`: PATCH handler to confirm upload (verify S3 object exists via HEAD, set status to active), DELETE handler to soft-delete (set status to deleted)
- [ ] 4.3 Register both API routes in `apps/journal/app/routes.ts`

## 5. Client-Side Image Processing

- [ ] 5.1 Create `apps/journal/app/lib/image-processing.ts`: `resizeImage(file, maxDimension)` using canvas, outputs WebP blob (JPEG fallback), strips EXIF by virtue of canvas redraw, handles orientation via `createImageBitmap`
- [ ] 5.2 Create `apps/journal/app/components/PhotoUploader.tsx`: file input (accept image types), processes each file through `resizeImage`, requests presigned URL from API, uploads to S3 via fetch PUT, confirms via PATCH, shows progress per photo
- [ ] 5.3 Add size and count validation in the uploader: max 5 MB per photo after processing, max 20 photos per activity, show clear error messages

## 6. Photo Display

- [ ] 6.1 Update activity detail loader (`activities.$id.tsx`) to fetch active photos for the activity and generate presigned GET URLs (1 hour expiry)
- [ ] 6.2 Create `apps/journal/app/components/PhotoGallery.tsx`: responsive grid (1/2/3 columns), `object-cover` thumbnails, `loading="lazy"`, click to open lightbox
- [ ] 6.3 Create `apps/journal/app/components/PhotoLightbox.tsx`: full-screen overlay, left/right navigation, close on escape/backdrop click, alt text display
- [ ] 6.4 Integrate PhotoGallery into activity detail page, show "Add photos" button for owner

## 7. Photo Management

- [ ] 7.1 Add delete button (trash icon) on each photo in gallery view (owner only), calls DELETE endpoint, optimistically removes from UI
- [ ] 7.2 Add alt text editing: inline text input below each photo in edit mode, saves via PATCH endpoint

## 8. Cleanup

- [ ] 8.1 Add cleanup logic in `storage.server.ts`: function to find photos with status `deleted` or `pending` older than 1 hour, delete S3 objects, remove database rows
- [ ] 8.2 Call cleanup on activity detail page load (non-blocking) and on app startup

## 9. Privacy Manifest

- [ ] 9.1 Update `apps/journal/app/routes/privacy.tsx`: add "Photos" section documenting S3 storage, EXIF stripping, deletion behavior, data export plans
- [ ] 9.2 Add note about EXIF stripping in the upload UI (tooltip or help text explaining GPS/metadata removal)

## 10. i18n

- [ ] 10.1 Add translation keys (en + de) for: "Add photos", "Delete photo", "Photo uploaded", upload errors, photo count limit, alt text placeholder, EXIF stripping explanation, privacy manifest photo section

## 11. Testing

- [ ] 11.1 Unit tests for `image-processing.ts`: verify resize output dimensions, WebP output, size within limits, EXIF data absent from output
- [ ] 11.2 Unit tests for `storage.server.ts`: presigned URL generation, delete, head object (mock S3 client)
- [ ] 11.3 Unit tests for photo API routes: ownership validation, count limits, status transitions (pending -> active -> deleted)
- [ ] 11.4 E2E test: upload a photo on an activity, verify it appears in the gallery, delete it, verify it disappears
