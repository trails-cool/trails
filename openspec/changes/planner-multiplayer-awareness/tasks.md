## 1. Name Editing

- [ ] 1.1 Update use-yjs.ts: allow updating user name via a returned setter function
- [ ] 1.2 Save updated name to localStorage and sync via awareness.setLocalStateField
- [ ] 1.3 Add i18n keys for participant UI (en + de)

## 2. Participant List

- [ ] 2.1 Create ParticipantList component showing all awareness states (name, color dot, host badge)
- [ ] 2.2 Add inline name edit when clicking own name in the list
- [ ] 2.3 Integrate ParticipantList into SessionView header

## 3. Cursor Styling

- [ ] 3.1 Replace current divIcon cursor with SVG pointer arrow + styled name tag (background, shadow, rounded)
- [ ] 3.2 Set cursor z-index below map controls to avoid overlap

## 4. Join/Leave Toasts

- [ ] 4.1 Track awareness changes (added/removed clients) in SessionView
- [ ] 4.2 Show auto-dismissing toast when participant joins or leaves (3 second duration)

## 5. Verify

- [ ] 5.1 Test with two browser windows: verify participant list, name editing, cursor rendering
- [ ] 5.2 Verify join/leave toasts appear correctly
- [ ] 5.3 Verify name persists across page refresh (localStorage)
