## 1. Journal Navigation Bar

- [x] 1.1 Add nav bar to Journal root Layout — show "Routes", "Activities" links when logged in; "Login", "Register" when logged out
- [x] 1.2 Add user menu to nav bar — username/display name linking to profile, logout button
- [x] 1.3 Highlight active nav item based on current route
- [x] 1.4 Add i18n keys for nav labels (en + de): routes, activities, profile, logout

## 2. Planner Navigation

- [x] 2.1 Add "Start Planning" CTA button on Planner home page linking to `/new` (already done in planner-landing-page change)
- [x] 2.2 Add home link (logo or text) to SessionView header
- [x] 2.3 Add i18n keys for planner nav (en + de): startPlanning, home

## 3. Verify

- [x] 3.1 Verify all Journal routes are reachable via navigation (routes, activities, profile, auth, privacy)
- [x] 3.2 Verify Planner home → new session → back to home works
- [x] 3.3 Update E2E tests if navigation changes affect existing selectors
