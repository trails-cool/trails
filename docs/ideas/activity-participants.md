# Activity participants (group tagging)

Pre-spec exploration. From `docs/architecture.md` §Activity Sharing &
Participants: when people ride/hike together, the activity creator tags
the others; tagged users confirm or decline; confirmed participants see
the activity on their own profile and can attach their own GPS trace and
photos. "Like photo tagging on social media, but for rides."

The `activities.participants` jsonb column exists as an untyped stub —
no flow, UI, or spec behind it.

## Scope sketch

**v1 (local)**
- Tag local users on your activity (search by username, like the
  share dialog planned in `route-sharing`)
- Notification `participant_tagged` → confirm / decline (Requests-tab
  pattern from follow requests)
- Confirmed participation renders the activity on the participant's
  profile (clearly attributed: "with @alice")
- Participant may attach their own trace + photos to the shared
  activity — or link their own existing activity as "same outing"
  (the second option composes better with imports: Bob's Garmin
  recording is already its own activity)
- Schema: promote from jsonb stub to a real
  `journal.activity_participants` table
  (`activity_id, user_id | participant_actor_iri, status, own_activity_id?`)
  — the exactly-one-of local/remote pattern from `follows` again

**v2 (federated)**
- Tagging across trails instances; Mastodon sees mentions
  (`"Rode with @bob@bob.trails.xyz"`) per the architecture
- Confirm/decline crosses instances → needs a small custom activity
  vocabulary or reuse of `Invite`/`Accept` (the same pair
  route-federation needs — design together)

## Constraints & notes

- Privacy: being tagged must never reveal more than the tagger could
  already see; declined/pending tags are visible only to tagger +
  taggee. Tagging requires the activity to be visible to the taggee.
- The "link own activity as same outing" model doubles as the natural
  seed for multi-day collections' "shared trip" case — see
  `multi-day-collections.md`.
- Mention-style federation means participant handles end up in public
  Note content — privacy manifest update when v2 lands.
