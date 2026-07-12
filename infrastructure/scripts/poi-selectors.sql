-- GENERATED from @trails-cool/map-core poiCategories. Do not edit by hand;
-- regenerate with: npx tsx infrastructure/scripts/gen-poi-selectors-sql.ts
-- Loaded by poi-import.sh inside the import transaction to classify each
-- extracted OSM element into one row per matching category.
CREATE TEMP TABLE poi_selector (key text, value text, category text) ON COMMIT DROP;
INSERT INTO poi_selector (key, value, category) VALUES
  ('amenity', 'drinking_water', 'drinking_water'),
  ('amenity', 'water_point', 'drinking_water'),
  ('amenity', 'shelter', 'shelter'),
  ('tourism', 'wilderness_hut', 'shelter'),
  ('tourism', 'camp_site', 'camping'),
  ('tourism', 'caravan_site', 'camping'),
  ('amenity', 'restaurant', 'food'),
  ('amenity', 'cafe', 'food'),
  ('amenity', 'fast_food', 'food'),
  ('amenity', 'pub', 'food'),
  ('amenity', 'biergarten', 'food'),
  ('shop', 'supermarket', 'groceries'),
  ('shop', 'convenience', 'groceries'),
  ('shop', 'bakery', 'groceries'),
  ('amenity', 'bicycle_parking', 'bike_infra'),
  ('amenity', 'bicycle_repair_station', 'bike_infra'),
  ('amenity', 'bicycle_rental', 'bike_infra'),
  ('tourism', 'hotel', 'accommodation'),
  ('tourism', 'hostel', 'accommodation'),
  ('tourism', 'guest_house', 'accommodation'),
  ('tourism', 'viewpoint', 'viewpoints'),
  ('amenity', 'toilets', 'toilets');
