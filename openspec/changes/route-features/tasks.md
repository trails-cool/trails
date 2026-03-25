## 1. Route Visibility & Sharing Schema

- [ ] 1.1 Add `visibility` enum column (private, public) to `journal.routes`, default private
- [ ] 1.2 Add `visibility` enum column (private, public) to `journal.activities`, default private
- [ ] 1.3 Create `journal.route_shares` table (routeId, userId, permission: view/edit)
- [ ] 1.4 Add `contributors` text array column to `journal.route_versions`
- [ ] 1.5 Add `forkedFromId` nullable column to `journal.routes`
- [ ] 1.6 Push schema and verify locally

## 2. Route Permissions Logic

- [ ] 2.1 Create `apps/journal/app/lib/permissions.server.ts` with canView(routeId, userId), canEdit(routeId, userId) functions
- [ ] 2.2 Update route detail loader to check visibility/permissions (show 404 for unauthorized)
- [ ] 2.3 Update route list to only show own + shared routes
- [ ] 2.4 Add visibility toggle (private/public) to route edit page
- [ ] 2.5 Add share dialog — search users, set view/edit permission

## 3. Route Forking

- [ ] 3.1 Add "Fork" button on public route detail pages (visible to logged-in users who aren't the owner)
- [ ] 3.2 Create fork API route — copies route + latest GPX to user's collection, sets forkedFromId
- [ ] 3.3 Show "Forked from [original]" link on forked routes

## 4. Spatial Search

- [ ] 4.1 Ensure PostGIS spatial index exists on routes.geometry column
- [ ] 4.2 Create `/routes/explore` route with a full-page map
- [ ] 4.3 Add API route to query public routes within bounding box (ST_Intersects)
- [ ] 4.4 Render matching routes as polylines on the explore map
- [ ] 4.5 Add route popup/sidebar with name, stats, link to detail

## 5. Multi-Day Routes

- [ ] 5.1 Add `isDayBreak` optional boolean support to Planner waypoint Y.Map
- [ ] 5.2 Add day-break toggle in Planner waypoint sidebar (click to mark/unmark)
- [ ] 5.3 Show day boundaries in elevation chart
- [ ] 5.4 Compute per-day distance and elevation in sidebar
- [ ] 5.5 Update GPX export to use one track segment per day
- [ ] 5.6 Store dayBreaks array in route metadata on save

## 6. Activity Photos

- [ ] 6.1 Enable Garage in docker-compose.yml, create bucket
- [ ] 6.2 Create S3 client utility (`apps/journal/app/lib/storage.server.ts`) with presigned URL generation
- [ ] 6.3 Create `journal.activity_photos` table (id, activityId, s3Key, altText, createdAt)
- [ ] 6.4 Add photo upload UI on activity detail/edit page
- [ ] 6.5 Display photo gallery on activity detail page
- [ ] 6.6 Add delete photo functionality

## 7. Contributor Tracking

- [ ] 7.1 Update Planner→Journal callback to include contributor info from JWT
- [ ] 7.2 Store contributor in route_versions on save
- [ ] 7.3 Display contributors on route detail page

## 8. Privacy & i18n

- [ ] 8.1 Update /privacy page: document photo storage, route visibility, sharing
- [ ] 8.2 Add i18n keys for all new UI strings (en + de)

## 9. Verify

- [ ] 9.1 Test route visibility: create private and public routes, verify access control
- [ ] 9.2 Test sharing: share route with another user, verify view/edit access
- [ ] 9.3 Test forking: fork a public route, verify copy created
- [ ] 9.4 Test spatial search: create public routes, verify they appear on explore map
- [ ] 9.5 Test multi-day: mark day breaks, verify per-day stats and GPX export
- [ ] 9.6 Test photos: upload, view, delete photos on activities
