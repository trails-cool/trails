## ADDED Requirements

### Requirement: Elevation profile chart on detail pages
The route and activity detail pages SHALL render an elevation profile chart (distance on the x-axis, elevation on the y-axis) with a gradient area fill and a summary showing the highest and lowest points, whenever the activity or route has a usable elevation series. (Ascent and descent are shown in the headline stat row above the chart.)

#### Scenario: Chart shown for a route with elevation
- **WHEN** a user views a route whose GPX contains an elevation series
- **THEN** an elevation profile chart is shown with a highest/lowest summary

#### Scenario: Chart omitted without elevation
- **WHEN** an activity's GPX has no usable elevation data
- **THEN** no chart is rendered and the existing gain/loss figures remain

### Requirement: Chart-to-map highlight
The detail page SHALL highlight the corresponding location on the map when the user points at a position on the elevation chart.

#### Scenario: Hover chart highlights map
- **WHEN** the user moves the pointer along the elevation chart
- **THEN** a marker appears on the map at the location matching that distance along the route

### Requirement: Map-to-chart highlight
The detail page SHALL highlight the corresponding position on the elevation chart when the user points at the route line on the map.

#### Scenario: Hover map highlights chart
- **WHEN** the user moves the pointer along the route line on the map
- **THEN** the elevation chart marks the position matching the nearest point on the route

### Requirement: Click chart to center map
The detail page SHALL center the map on the corresponding location when the user clicks a position on the elevation chart, without modifying any data.

#### Scenario: Click chart pans map
- **WHEN** the user clicks a point on the elevation chart
- **THEN** the map centers on the matching location
- **AND** no route or activity data is changed

### Requirement: Localized summary labels
The elevation summary strip SHALL render its labels and units through localized strings.

#### Scenario: German summary labels
- **WHEN** the UI locale is German
- **THEN** the highest and lowest labels render in German
