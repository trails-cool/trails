## ADDED Requirements

### Requirement: Photo upload via presigned URLs
Users SHALL be able to upload photos to an activity using presigned PUT URLs, with client-side image processing before upload.

#### Scenario: Upload photo
- **WHEN** a user selects a photo on the activity detail page
- **THEN** the client resizes the image (max 2048px long edge), strips EXIF data, converts to WebP
- **AND** requests a presigned PUT URL from `POST /api/activities/:id/photos`
- **AND** uploads directly to Garage (S3-compatible storage)
- **AND** confirms the upload via `PATCH /api/activities/:id/photos/:photoId`

#### Scenario: Size limit enforced
- **WHEN** a processed photo exceeds 5 MB
- **THEN** the presigned URL rejects the upload via content-length condition

#### Scenario: Per-activity photo limit
- **WHEN** an activity already has 20 photos
- **THEN** the server rejects new presigned URL requests

### Requirement: Photo gallery display
The activity detail page SHALL display uploaded photos in a responsive grid with lightbox viewing.

#### Scenario: Gallery grid
- **WHEN** a user views an activity with photos
- **THEN** photos are displayed in a responsive grid (1 column mobile, 2 tablet, 3 desktop) with lazy loading

#### Scenario: Lightbox view
- **WHEN** a user clicks a photo in the gallery
- **THEN** a full-size lightbox overlay opens with left/right navigation and close on escape

### Requirement: Photo deletion
Activity owners SHALL be able to delete photos with soft delete and background S3 cleanup.

#### Scenario: Delete photo
- **WHEN** a user clicks the delete icon on a photo
- **THEN** the photo status is set to 'deleted' and it disappears from the UI
- **AND** the S3 object is cleaned up on next page load or periodic cleanup

### Requirement: Photo storage infrastructure
Photos SHALL be stored in Garage (S3-compatible, self-hosted) running as a Docker container.

#### Scenario: Garage container
- **WHEN** docker compose starts
- **THEN** a Garage container is running with an `activity-photos` bucket

### Requirement: Photo privacy disclosure
Photo storage and EXIF handling SHALL be documented in the privacy manifest.

#### Scenario: Privacy page updated
- **WHEN** a user visits the privacy page
- **THEN** it documents photo storage location, EXIF stripping, and deletion behavior
