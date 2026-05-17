# Tasks: Journal POI Details

- [x] Extend `Waypoint` type in `packages/types/src/index.ts` with `osmId` and `poiTags` fields
- [x] Extract `osmId` and `poiTags` from Yjs Y.Map in `apps/planner/app/components/ExportButton.tsx`
- [x] Extract `osmId` and `poiTags` from Yjs Y.Map in `apps/planner/app/components/SaveToJournalButton.tsx`
- [x] Encode POI fields as `<trails:poi>` extensions in `packages/gpx/src/generate.ts`
- [x] Parse `<trails:poi>` extensions back into waypoints in `packages/gpx/src/parse.ts`
- [x] Add unit tests for GPX POI encode/decode roundtrip in `packages/gpx/src/`
- [x] Pass parsed waypoints with POI data from the loader in `apps/journal/app/routes/routes.$id.tsx`
- [x] Render POI details (phone, website, opening hours, address) for waypoints in the Journal route detail page
- [x] Add i18n keys for POI section labels (phone, website, opening hours, address)
