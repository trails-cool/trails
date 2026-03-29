## ADDED Requirements

### Requirement: Photo attachments on activities
Users SHALL be able to upload photos to their activities.

#### Scenario: Upload photo
- **WHEN** a user adds a photo to an activity
- **THEN** the photo is uploaded to S3 storage and linked to the activity

#### Scenario: View photos
- **WHEN** a user views an activity with photos
- **THEN** the photos are displayed in a gallery on the activity page

#### Scenario: Delete photo
- **WHEN** a user deletes a photo from their activity
- **THEN** the photo is removed from storage and unlinked
