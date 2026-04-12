## 1. Route Hover → Chart Highlight

- [x] 1.1 Add invisible interactive overlay polyline on the route in PlannerMap for hover detection (avoids adding listeners to every ColoredRoute segment)
- [x] 1.2 On polyline hover, find closest route coordinate index and compute cumulative distance
- [x] 1.3 Pass `highlightChartDistance` up from PlannerMap to SessionView
- [x] 1.4 Accept `highlightDistance` prop in ElevationChart, find closest point by distance, draw crosshair

## 2. Chart Click → Map Pan

- [x] 2.1 Add click handler to ElevationChart canvas — convert x-position to route coordinate
- [x] 2.2 Call `onClickPosition([lat, lon])` callback to pan the map
- [x] 2.3 Wire the callback through SessionView to call `map.panTo()` via the exposed map ref

## 3. Chart Drag-Select → Map Zoom

- [x] 3.1 Add mousedown/mousemove/mouseup handlers for drag selection on ElevationChart canvas
- [x] 3.2 Draw semi-transparent overlay rectangle during drag
- [x] 3.3 On mouseup, compute bounding box of route coordinates in the selected distance range
- [x] 3.4 Call `onDragSelect(bounds)` callback to zoom the map via `map.fitBounds()`
- [x] 3.5 Show "Reset zoom" button after drag-zoom, clicking it returns to full route bounds

## 4. Testing

- [x] 4.1 E2E test: hover chart → map dot appears (existing, verify still works)
- [x] 4.2 E2E test: click chart → map pans (verify map center changes)
