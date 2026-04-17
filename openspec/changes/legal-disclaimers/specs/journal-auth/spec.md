## ADDED Requirements

### Requirement: Terms acknowledgement at signup
The registration form SHALL require explicit acknowledgement of the Terms of Service before an account can be created.

#### Scenario: Checkbox required
- **WHEN** a user views the registration form
- **THEN** they see a required checkbox labeled "I have read and agree to the Terms of Service, including that trails.cool is in alpha and my data may be reset"
- **AND** the checkbox label links to the Terms page

#### Scenario: Cannot submit without acknowledgement
- **WHEN** a user attempts to register without checking the acknowledgement box
- **THEN** the form blocks submission and shows a validation message

#### Scenario: Acknowledgement recorded
- **WHEN** a user successfully registers
- **THEN** the current timestamp is stored in `users.terms_accepted_at`
