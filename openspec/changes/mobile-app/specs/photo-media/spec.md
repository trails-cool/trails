## ADDED Requirements

### Requirement: Presigned upload URL
The Journal API SHALL provide presigned upload URLs for direct-to-storage file uploads.

#### Scenario: Request upload URL
- **WHEN** a client sends `POST /api/v1/uploads` with filename and content type
- **THEN** the server returns a presigned upload URL for S3/Garage and a storage key to reference the uploaded file

#### Scenario: Upload photo directly to storage
- **WHEN** the client receives a presigned URL
- **THEN** the client uploads the file directly to S3/Garage using an HTTP PUT to the presigned URL, bypassing the Journal server

### Requirement: Photo attachment on routes and activities
Routes and activities SHALL support an array of attached photos.

#### Scenario: Attach photo to route
- **WHEN** a client creates or updates a route with storage keys in the photos array
- **THEN** the route record stores the photo references and they are returned in subsequent GET requests with `url` and `thumbnailUrl`

#### Scenario: Attach photo to activity
- **WHEN** a client creates an activity with storage keys in the photos array
- **THEN** the activity record stores the photo references and they are returned in subsequent GET requests

### Requirement: Server-side thumbnail generation
The Journal SHALL generate thumbnails when a photo upload is confirmed.

#### Scenario: Thumbnail created on upload confirmation
- **WHEN** a route or activity is saved with a new photo storage key
- **THEN** the server reads the original image from storage, generates a resized thumbnail, stores it alongside the original, and records both URLs

### Requirement: Photo display
Clients SHALL display photos in route and activity detail views.

#### Scenario: View photos in route detail
- **WHEN** a client fetches a route with attached photos
- **THEN** the response includes an array of photo objects with `url` (full size) and `thumbnailUrl` (resized)

#### Scenario: Delete photo
- **WHEN** a client updates a route or activity and removes a storage key from the photos array
- **THEN** the photo and its thumbnail are deleted from storage on save
