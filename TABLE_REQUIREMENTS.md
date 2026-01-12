# Table Requirements for Koop Provider

This guide explains how to prepare your Databricks tables to work with the Koop provider and expose them as ArcGIS FeatureServer layers.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Required Columns](#required-columns)
3. [Geometry Column (WKT Format)](#geometry-column-wkt-format)
4. [Object ID Column](#object-id-column)
5. [Configuration Options](#configuration-options)
6. [Preparing Existing Tables](#preparing-existing-tables)
7. [Geometry Type Examples](#geometry-type-examples)
8. [Advanced Configuration](#advanced-configuration)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

To expose a table as a FeatureServer layer, your table needs:

1. **An ObjectID column** (unique integer identifier)
2. **A geometry column** (WKT string format)
3. **Proper configuration** (column names in `config/default.json`)

**Minimal Example:**
```sql
CREATE TABLE main.default.my_cities (
  objectid INT,              -- Unique ID
  city_name STRING,          -- Your attributes
  population BIGINT,         -- Your attributes
  geometry_wkt STRING        -- WKT geometry: "POINT(-74.0060 40.7128)"
)
```

**Access URL:**
```
https://your-server/databricks/rest/services/main.default.my_cities/FeatureServer/0
```

---

## Required Columns

### 1. Object ID Column

**Purpose:** Unique identifier for each feature (row)

**Requirements:**
- Must be an INTEGER type
- Must be unique for each row
- Must not be NULL
- Typically named `objectid` (configurable)

**Example:**
```sql
CREATE TABLE my_table (
  objectid INT,              -- ✅ Unique identifier
  -- other columns...
)
```

### 2. Geometry Column

**Purpose:** Stores the spatial location/shape of each feature

**Requirements:**
- Must be a STRING type containing WKT (Well-Known Text)
- Must be valid WKT format
- Must not be NULL for features you want to display
- Typically named `geometry_wkt` or `geometry` (configurable)

**Supported Geometry Types:**
- `POINT` - Single location (cities, facilities, markers)
- `LINESTRING` - Path or route (roads, rivers, pipelines)
- `POLYGON` - Area or boundary (states, parcels, zones)
- `MULTIPOINT`, `MULTILINESTRING`, `MULTIPOLYGON` - Collections

**Example:**
```sql
CREATE TABLE my_table (
  objectid INT,
  geometry_wkt STRING,       -- ✅ WKT geometry
  -- other columns...
)

-- Insert example with Point geometry
INSERT INTO my_table VALUES (
  1,
  'POINT(-122.4194 37.7749)',  -- San Francisco
  -- other values...
)
```

---

## Geometry Column (WKT Format)

### What is WKT?

Well-Known Text (WKT) is a text format for representing spatial geometries. It's human-readable and widely supported.

### WKT Format by Geometry Type

#### Point (Single Location)
```sql
-- Format: POINT(longitude latitude)
geometry_wkt = 'POINT(-122.4194 37.7749)'

-- ⚠️ IMPORTANT: Longitude first, then latitude (X Y order)
-- Correct:  POINT(-122.4194 37.7749)  -- (lon, lat)
-- Wrong:    POINT(37.7749 -122.4194)  -- (lat, lon) ❌
```

**When to use:** Cities, buildings, markers, facilities, points of interest

#### LineString (Path or Route)
```sql
-- Format: LINESTRING(lon1 lat1, lon2 lat2, lon3 lat3, ...)
geometry_wkt = 'LINESTRING(-122.4 37.8, -122.3 37.7, -122.2 37.6)'
```

**When to use:** Roads, highways, rivers, pipelines, routes, trails

#### Polygon (Area or Boundary)
```sql
-- Format: POLYGON((lon1 lat1, lon2 lat2, ..., lon1 lat1))
-- ⚠️ First and last coordinate must be the same (closed ring)
geometry_wkt = 'POLYGON((-122.5 37.8, -122.3 37.8, -122.3 37.6, -122.5 37.6, -122.5 37.8))'
```

**When to use:** State boundaries, parcels, zones, land use areas, buildings

### Creating WKT from Lat/Lon Columns

If you have separate `latitude` and `longitude` columns:

```sql
-- Create Point WKT from lat/lon columns
SELECT
  objectid,
  CONCAT('POINT(', longitude, ' ', latitude, ')') as geometry_wkt,
  city_name
FROM my_raw_table
```

**Example transformation:**
```sql
CREATE TABLE my_cities_with_wkt AS
SELECT
  id as objectid,
  city_name,
  population,
  CONCAT('POINT(', lon, ' ', lat, ')') as geometry_wkt
FROM my_raw_cities
```

### Creating WKT from Geometry Columns

If you have native geometry columns (GEOMETRY type):

```sql
-- Convert GEOMETRY column to WKT string
CREATE TABLE my_table_with_wkt AS
SELECT
  objectid,
  ST_AsText(geom) as geometry_wkt,  -- Convert to WKT
  other_column
FROM my_table_with_geom
```

---

## Object ID Column

### Requirements

The ObjectID column:
- **Must be unique** - No duplicates allowed
- **Must be an integer** - INT, BIGINT, etc.
- **Must start from 1 or higher** - Positive integers only
- **Should be sequential** - For best performance (1, 2, 3, ...)

### Creating ObjectID from Existing Tables

If your table doesn't have an ObjectID:

**Option 1: Add ObjectID with ROW_NUMBER**
```sql
CREATE TABLE my_table_with_objectid AS
SELECT
  ROW_NUMBER() OVER (ORDER BY id) as objectid,
  *
FROM my_existing_table
```

**Option 2: Use Existing ID Column**
```sql
-- If you have a unique ID column already
CREATE VIEW my_table_view AS
SELECT
  id as objectid,              -- Rename existing ID
  geometry_col as geometry_wkt,
  *
FROM my_existing_table
WHERE geometry_col IS NOT NULL   -- Filter out null geometries
```

---

## Configuration Options

Configure the provider in `config/default.json`:

```json
{
  "objectId": "objectid",
  "geometryColumn": "geometry_wkt",
  "spatialReference": 4326,
  "maxRows": 10000
}
```

### Configuration Parameters

#### 1. `objectId` (Default: `"objectid"`)

**What it is:** Name of your unique identifier column

**When to change:**
- Your table uses `id`, `feature_id`, `gid`, etc. instead of `objectid`

**Example:**
```json
{
  "objectId": "feature_id"
}
```

#### 2. `geometryColumn` (Default: `"geometry_wkt"`)

**What it is:** Name of your WKT geometry column

**When to change:**
- Your column is named `geometry`, `geom`, `wkt`, `shape`, etc.

**Example:**
```json
{
  "geometryColumn": "geometry"
}
```

#### 3. `spatialReference` (Default: `4326`)

**What it is:** SRID (Spatial Reference ID) for your coordinates

**Common values:**
- `4326` - WGS84 (Latitude/Longitude) - **MOST COMMON**
- `3857` - Web Mercator (Web mapping)
- `2163` - US National Atlas Equal Area
- Custom SRID for your projection

**When to change:**
- Your geometries use a different coordinate system
- You're working with projected coordinates (meters instead of degrees)

**Example:**
```json
{
  "spatialReference": 3857
}
```

#### 4. `maxRows` (Default: `10000`)

**What it is:** Maximum number of features returned per query

**Why it matters:**
- **Prevents large queries** from overwhelming the server
- **Client-side pagination** automatically requests more data as needed
- **Balance between performance and responsiveness**

**When to change:**

**Increase if:**
- You have powerful hardware
- Clients need more data per request
- Network latency is high (fewer round-trips)

**Decrease if:**
- Queries are timing out
- You want faster initial response times
- Memory constraints

**Examples:**

```json
// For small datasets or powerful infrastructure
{
  "maxRows": 50000
}

// For very large datasets or limited resources
{
  "maxRows": 1000
}

// No practical limit (use with caution!)
{
  "maxRows": 999999999
}
```

**⚠️ Important Notes:**
- ArcGIS clients automatically handle pagination
- Users won't notice the difference - they'll still see all features
- Smaller `maxRows` = faster initial load, more requests
- Larger `maxRows` = slower initial load, fewer requests

---

## Preparing Existing Tables

### Scenario 1: Table Has Lat/Lon Columns

**Input table:**
```
| id | name          | lat      | lon        | population |
|----|---------------|----------|------------|------------|
| 1  | San Francisco | 37.7749  | -122.4194  | 881549     |
| 2  | Los Angeles   | 34.0522  | -118.2437  | 3979576    |
```

**Solution: Create View with WKT**
```sql
CREATE VIEW my_cities_koop AS
SELECT
  id as objectid,
  name,
  population,
  CONCAT('POINT(', lon, ' ', lat, ')') as geometry_wkt
FROM my_cities_raw
```

**Access:**
```
/databricks/rest/services/main.default.my_cities_koop/FeatureServer/0
```

### Scenario 2: Table Has Native GEOMETRY Column

**Input table:**
```sql
CREATE TABLE my_parcels (
  parcel_id INT,
  geom GEOMETRY,
  owner STRING,
  area DOUBLE
)
```

**Solution: Convert to WKT**
```sql
CREATE VIEW my_parcels_koop AS
SELECT
  parcel_id as objectid,
  ST_AsText(geom) as geometry_wkt,
  owner,
  area
FROM my_parcels
WHERE geom IS NOT NULL
```

### Scenario 3: Table Has H3 Cells

**Input table:**
```
| id | h3_index          | value |
|----|-------------------|-------|
| 1  | 8f2830828052d1f  | 42    |
```

**Solution: Convert H3 to WKT Polygon**
```sql
CREATE VIEW my_h3_data_koop AS
SELECT
  id as objectid,
  h3_togeoboundary(h3_index) as geometry_wkt,  -- H3 cell to WKT
  value
FROM my_h3_data
```

### Scenario 4: Different Column Names

**Input table:**
```
| feature_id | shape_wkt               | attribute |
|------------|-------------------------|-----------|
| 100        | POINT(-122.4 37.8)     | value1    |
```

**Solution A: Create View with Renamed Columns**
```sql
CREATE VIEW my_features_koop AS
SELECT
  feature_id as objectid,
  shape_wkt as geometry_wkt,
  attribute
FROM my_features
```

**Solution B: Update Config Instead**
```json
{
  "objectId": "feature_id",
  "geometryColumn": "shape_wkt"
}
```

---

## Geometry Type Examples

### Points (Cities Example)

```sql
CREATE TABLE cities (
  objectid INT,
  city_name STRING,
  state STRING,
  population BIGINT,
  geometry_wkt STRING
)

INSERT INTO cities VALUES
  (1, 'San Francisco', 'California', 881549, 'POINT(-122.4194 37.7749)'),
  (2, 'Los Angeles', 'California', 3979576, 'POINT(-118.2437 34.0522)'),
  (3, 'New York', 'New York', 8336817, 'POINT(-74.0060 40.7128)')
```

**Use case:** Markers, facilities, POIs, stores, landmarks

### LineStrings (Roads Example)

```sql
CREATE TABLE highways (
  objectid INT,
  highway_name STRING,
  length_miles DOUBLE,
  geometry_wkt STRING
)

INSERT INTO highways VALUES
  (1, 'I-80', 450,
   'LINESTRING(-122.4 37.8, -122.0 38.0, -121.5 38.5, -121.0 39.0)'),
  (2, 'US-101',
   'LINESTRING(-122.5 37.7, -122.4 37.8, -122.3 38.0)')
```

**Use case:** Roads, rivers, pipelines, utility lines, routes

### Polygons (States Example)

```sql
CREATE TABLE states (
  objectid INT,
  state_name STRING,
  area_sqmi DOUBLE,
  geometry_wkt STRING
)

INSERT INTO states VALUES
  (1, 'Colorado', 104094,
   'POLYGON((-109.05 41.00, -102.05 41.00, -102.05 37.00, -109.05 37.00, -109.05 41.00))')
```

**Use case:** Boundaries, parcels, zones, land use, buildings, service areas

---

## Advanced Configuration

### Using Environment Variables

Override config values without editing files:

```bash
# Override geometry column name
export GEOMETRY_COLUMN="geom"

# Override object ID column name
export OBJECT_ID_COLUMN="feature_id"

# Override spatial reference
export SPATIAL_REFERENCE="3857"

# Override max rows
export MAX_ROWS="5000"

npm start
```

### Per-Table Configuration

If different tables need different settings, create multiple provider instances or use views to standardize:

```sql
-- Standardize table1 with different column names
CREATE VIEW table1_standard AS
SELECT
  id as objectid,
  shape as geometry_wkt,
  *
FROM table1

-- Now both tables work with same config
-- Access: /databricks/rest/services/main.default.table1_standard/FeatureServer/0
```

### Multiple Geometry Columns

If your table has multiple geometry columns (e.g., centroid + boundary):

```sql
-- Create separate views for each geometry
CREATE VIEW parcels_centroids AS
SELECT
  objectid,
  centroid_wkt as geometry_wkt,
  address
FROM parcels

CREATE VIEW parcels_boundaries AS
SELECT
  objectid,
  boundary_wkt as geometry_wkt,
  address
FROM parcels
```

Access as different layers:
- `/databricks/rest/services/main.default.parcels_centroids/FeatureServer/0`
- `/databricks/rest/services/main.default.parcels_boundaries/FeatureServer/0`

---

## Troubleshooting

### "Layer failed to load" Error

**Possible causes:**

1. **Missing ObjectID column**
   ```sql
   -- Check if column exists
   DESCRIBE TABLE main.default.my_table

   -- Add if missing
   CREATE VIEW my_table_fixed AS
   SELECT ROW_NUMBER() OVER (ORDER BY id) as objectid, *
   FROM my_table
   ```

2. **Invalid WKT geometry**
   ```sql
   -- Check for invalid WKT
   SELECT objectid, geometry_wkt
   FROM my_table
   WHERE ST_GeomFromText(geometry_wkt, 4326) IS NULL

   -- Filter out invalid geometries
   CREATE VIEW my_table_valid AS
   SELECT *
   FROM my_table
   WHERE ST_GeomFromText(geometry_wkt, 4326) IS NOT NULL
   ```

3. **Wrong column names in config**
   ```bash
   # Check server logs for actual column names
   npm start
   # Look for: "Configuration: objectId=..., geometryColumn=..."
   ```

### "Features don't display" Error

**Possible causes:**

1. **Lat/Lon order reversed**
   ```sql
   -- ❌ Wrong: POINT(latitude longitude)
   -- ✅ Right: POINT(longitude latitude)

   -- Fix existing data
   UPDATE my_table
   SET geometry_wkt = CONCAT(
     'POINT(',
     longitude, ' ', latitude,  -- lon first, then lat
     ')'
   )
   ```

2. **Wrong spatial reference**
   ```json
   // If your coordinates are in Web Mercator (meters)
   {
     "spatialReference": 3857
   }
   ```

3. **Geometries outside visible extent**
   ```sql
   -- Check coordinate ranges
   SELECT
     MIN(ST_X(ST_GeomFromText(geometry_wkt, 4326))) as min_lon,
     MAX(ST_X(ST_GeomFromText(geometry_wkt, 4326))) as max_lon,
     MIN(ST_Y(ST_GeomFromText(geometry_wkt, 4326))) as min_lat,
     MAX(ST_Y(ST_GeomFromText(geometry_wkt, 4326))) as max_lat
   FROM my_table

   -- Valid WGS84 ranges:
   -- Longitude: -180 to 180
   -- Latitude: -90 to 90
   ```

### "Query too slow" Error

**Solutions:**

1. **Reduce maxRows**
   ```json
   {
     "maxRows": 1000  // Smaller batches
   }
   ```

2. **Add indexes**
   ```sql
   -- Add index on objectid for faster queries
   CREATE INDEX idx_objectid ON my_table(objectid)
   ```

3. **Use OPTIMIZE**
   ```sql
   -- Compact and optimize Delta table
   OPTIMIZE main.default.my_table
   ZORDER BY (objectid)
   ```

### "Column not found" Error

Check configuration matches your table:

```sql
-- Show actual columns
DESCRIBE TABLE main.default.my_table

-- Compare with config/default.json
-- Make sure column names match exactly (case-sensitive)
```

---

## Complete Example Workflow

Here's a complete end-to-end example:

```sql
-- 1. Check existing table structure
DESCRIBE TABLE main.default.customer_locations;

-- Output shows:
-- | id | customer_name | latitude | longitude | revenue |

-- 2. Create Koop-compatible view
CREATE VIEW main.default.customer_locations_koop AS
SELECT
  id as objectid,
  customer_name,
  revenue,
  CONCAT('POINT(', longitude, ' ', latitude, ')') as geometry_wkt
FROM main.default.customer_locations
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL;

-- 3. Verify the view
SELECT * FROM main.default.customer_locations_koop LIMIT 5;

-- 4. Update config/default.json (if needed)
{
  "objectId": "objectid",
  "geometryColumn": "geometry_wkt",
  "spatialReference": 4326,
  "maxRows": 10000
}

-- 5. Start Koop server
npm start

-- 6. Access your layer
-- URL: http://localhost:8080/databricks/rest/services/main.default.customer_locations_koop/FeatureServer/0

-- 7. Test in browser
curl "http://localhost:8080/databricks/rest/services/main.default.customer_locations_koop/FeatureServer/0/query?where=1=1&returnCountOnly=true&f=json"
```

---

## Additional Resources

- [Well-Known Text (WKT) Specification](https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry)
- [Databricks Spatial Functions](https://docs.databricks.com/sql/language-manual/sql-ref-functions-builtin.html#spatial-functions)
- [ArcGIS FeatureServer API](https://developers.arcgis.com/rest/services-reference/enterprise/feature-service.htm)
- [EPSG Spatial Reference Codes](https://epsg.io/)

---

## Need Help?

For questions or issues:

1. Check [GitHub Issues](https://github.com/anandtrivedi/koop-provider-databricks/issues)
2. Review server logs with `LOG_LEVEL=DEBUG npm start`
3. Test your table structure with the SQL examples above
4. Verify WKT geometry with `ST_GeomFromText()` function
