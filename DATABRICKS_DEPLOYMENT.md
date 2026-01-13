# Koop Databricks Provider - Complete Guide

This comprehensive guide covers everything you need to prepare your tables, deploy the Koop provider, and connect to ArcGIS clients.

## Table of Contents

**Part 1: Table Preparation**
1. [Preparing Your Tables](#1-preparing-your-tables)
   - [Quick Start](#quick-start)
   - [Required Columns](#required-columns)
   - [Configuration Options](#configuration-options)
   - [Real-World Scenarios](#preparing-existing-tables)
   - [Troubleshooting](#troubleshooting-table-issues)

**Part 2: Deployment**
2. [Deployment Overview](#2-deployment-overview)
3. [Architecture](#3-architecture)
4. [Option 1: Databricks Apps](#4-option-1-databricks-apps-easiest)
5. [Option 2: Standalone Server](#5-option-2-standalone-koop-server-most-flexible)
6. [Option 3: Model Serving](#6-option-3-databricks-model-serving-advanced)

**Part 3: Testing & Integration**
7. [Testing the Deployment](#7-testing-the-deployment)
8. [Connecting to ArcGIS Online](#8-connecting-to-arcgis-online)

---

# Part 1: Table Preparation

## 1. Preparing Your Tables

Before deploying the Koop provider, your Databricks tables must be properly structured.

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
  "geometryFormat": "wkt",
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

**What it is:** Name of your geometry column

**When to change:**
- Your column is named `geometry`, `geom`, `wkt`, `shape`, etc.

**Example:**
```json
{
  "geometryColumn": "geometry"
}
```

#### 3. `geometryFormat` (Default: `"wkt"`)

**What it is:** Format of geometry data in the geometry column

**Supported formats:**
- `"wkt"` - **Well-Known Text** (default) - STRING column with WKT text like `'POINT(-122.4 37.8)'`
- `"wkb"` - **Well-Known Binary** - BINARY column with WKB binary data
- `"geojson"` - **GeoJSON** - STRING column with GeoJSON text like `'{"type":"Point","coordinates":[-122.4,37.8]}'`
- `"geometry"` - **Native Databricks GEOMETRY** - GEOMETRY type column

**When to change:**
- Your table uses WKB binary format instead of WKT text
- Your table has GeoJSON strings stored as text
- Your table has native Databricks GEOMETRY type columns
- Migrating from PostGIS or other spatial databases that use WKB

**Examples:**
```json
// For WKB binary format
{
  "geometryFormat": "wkb",
  "geometryColumn": "geometry_wkb"
}

// For GeoJSON string format
{
  "geometryFormat": "geojson",
  "geometryColumn": "geometry_geojson"
}

// For native Databricks GEOMETRY type
{
  "geometryFormat": "geometry",
  "geometryColumn": "geom"
}
```

**See Also:** [config/README.md](config/README.md#3-geometryformat-default-wkt) for detailed format documentation and conversion examples.

#### 4. `spatialReference` (Default: `4326`)

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

#### 5. `maxRows` (Default: `10000`)

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

**Solution: Use directly with native GEOMETRY format** ⚡ **BEST PERFORMANCE**
```sql
CREATE VIEW my_parcels_koop AS
SELECT
  parcel_id as objectid,
  geom as geometry,  -- Use native GEOMETRY directly!
  owner,
  area
FROM my_parcels
WHERE geom IS NOT NULL
```

**Configuration:**
```json
{
  "geometryColumn": "geometry",
  "geometryFormat": "geometry"
}
```

**Alternative: Convert to WKT** (if needed for compatibility)
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


---

# Part 2: Deployment

## 2. Deployment Overview


The Koop Databricks Provider can be deployed in multiple ways depending on your needs:

**Deployment Options:**

| Option | Difficulty | Best For | URL Format |
|--------|-----------|----------|------------|
| **Databricks Apps** | Easy | Fastest path to public URL, testing, demos | `https://<workspace>.databricksapps.com/...` |
| **Standalone Server** | Medium | Maximum flexibility, any cloud provider, existing infrastructure | `https://your-domain.com/...` |
| **Model Serving** | Advanced | Special Databricks integration requirements | `https://<workspace>.cloud.databricks.com/serving-endpoints/...` |

**Why use Databricks Apps or Model Serving?**

- ✅ **Native integration** - Direct access to Databricks SQL Warehouses without networking config
- ✅ **Secure** - Uses internal authentication, no need to expose credentials
- ✅ **Scalable** - Auto-scales with your SQL Warehouse
- ✅ **Managed** - HTTPS, domains, and hosting handled for you

**Why use Standalone?**

- ✅ **Maximum flexibility** - Deploy anywhere (AWS, Azure, GCP, on-prem)
- ✅ **Full control** - Customize networking, authentication, scaling
- ✅ **Integration** - Add to existing infrastructure and workflows
- ✅ **Standard Node.js** - Use any Node.js hosting environment

---

## 3. Architecture

### When Deployed on Databricks (Apps or Model Serving)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Databricks Platform                           │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              Deployed Koop Server (Container/App)              │ │
│  │                                                                  │ │
│  │  ┌──────────────┐        ┌─────────────────────────────────┐  │ │
│  │  │              │        │   Koop Databricks Provider       │  │ │
│  │  │   Express    │──────▶│   - Model (SQL queries)          │  │ │
│  │  │   Server     │        │   - Controller (API endpoints)   │  │ │
│  │  │   (Node.js)  │        │   - WKT to GeoJSON conversion    │  │ │
│  │  │              │        │   - Pagination & filtering       │  │ │
│  │  └──────────────┘        └────────────┬────────────────────┘  │ │
│  │                                        │                        │ │
│  │                                        │ SQL Queries            │ │
│  │                                        ▼                        │ │
│  │                            ┌──────────────────────┐           │ │
│  │                            │  SQL Warehouse       │           │ │
│  │                            │  (Serverless)        │           │ │
│  │                            └──────────┬───────────┘           │ │
│  │                                        │                        │ │
│  │                                        │ Reads from             │ │
│  │                                        ▼                        │ │
│  │                            ┌──────────────────────┐           │ │
│  │                            │  Delta Tables        │           │ │
│  │                            │  (with WKT geometry) │           │ │
│  │                            └──────────────────────┘           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Public URL: https://your-workspace.databricksapps.com/...          │
└───────────────────────────────────────────────────────────────────────┘
                               │
                               │ ArcGIS FeatureServer REST API
                               ▼
                    ┌──────────────────────────┐
                    │  Client Applications     │
                    │  - ArcGIS Pro            │
                    │  - ArcGIS Online         │
                    │  - ESRI JavaScript API   │
                    │  - Custom web apps       │
                    └──────────────────────────┘
```

### When Deployed Standalone

```
┌─────────────────────────────────────┐        ┌────────────────────────┐
│   Your Infrastructure (AWS/Azure/GCP│        │  Databricks Platform   │
│                                      │        │                        │
│  ┌────────────────────────────────┐ │        │  ┌──────────────────┐ │
│  │   Koop Server (Node.js)        │ │        │  │  SQL Warehouse   │ │
│  │   - Express Server             │ │────────┼─▶│  (Serverless)    │ │
│  │   - Koop Provider              │ │  HTTPS │  └────────┬─────────┘ │
│  │   - WKT→GeoJSON conversion     │ │        │           │           │
│  └────────────────────────────────┘ │        │           │           │
│                                      │        │           ▼           │
│  Public URL: https://your-domain.com│        │  ┌──────────────────┐ │
└──────────────────────────────────────┘        │  │  Delta Tables    │ │
               │                                 │  │  (WKT geometry)  │ │
               │ ArcGIS FeatureServer API        │  └──────────────────┘ │
               ▼                                 └────────────────────────┘
    ┌──────────────────────┐
    │  ArcGIS Clients      │
    │  - Pro, Online, etc  │
    └──────────────────────┘
```

### Key Components

1. **Koop Server**: Translates between Databricks tables and ArcGIS FeatureServer API
2. **Databricks Provider**: Custom plugin that queries SQL Warehouse and converts WKT geometries to GeoJSON
3. **SQL Warehouse**: Serverless compute that reads from Delta tables
4. **Delta Tables**: Your geospatial data with WKT geometry columns

### Data Flow

1. Client requests features via FeatureServer API endpoint
2. Koop provider generates SQL query with filters/pagination
3. SQL Warehouse executes query on Delta tables
4. Provider converts WKT geometries to GeoJSON
5. Response formatted as ArcGIS FeatureServer JSON
6. Client applications visualize data using ArcGIS tools

---

## 4. Option 1: Databricks Apps (Easiest)

**Best for:** Quick deployment, testing, demos, getting a public URL fast

Databricks Apps is the easiest way to deploy - you get a public HTTPS URL with zero configuration.

### Prerequisites

- Databricks workspace with Apps enabled
- Unity Catalog access
- SQL Warehouse running

### Step 1: Prepare the Application

The example application in `examples/databricks-app/` is ready to deploy. It includes:
- `app.yaml` - Databricks Apps configuration
- `Dockerfile` - Container definition
- `server.js` - Koop server setup
- `package.json` - Dependencies

### Step 2: Deploy via Databricks CLI

```bash
# Install Databricks CLI (if not already installed)
pip install databricks-cli

# Configure authentication
databricks configure --token

# Deploy the app
cd examples/databricks-app
databricks apps create koop-databricks-provider \
  --source-code-path .

# Get the app URL
databricks apps get koop-databricks-provider
```

### Step 3: Configure Environment Variables

In the Databricks Apps UI:

1. Go to your workspace → Apps → koop-databricks-provider
2. Click "Configuration"
3. Add environment variables:
   - `DATABRICKS_HTTP_PATH`: `/sql/1.0/warehouses/<warehouse-id>`
   - `DATABRICKS_TOKEN`: (use Databricks secret scope)

### Your Public URL

Your app will be available at:
```
https://<workspace-id>.databricksapps.com/<app-id>/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0
```

Example:
```
https://e2-demo-field-eng.databricksapps.com/koop-provider/databricks/rest/services/main.default.cities/FeatureServer/0
```

**Done!** You now have a publicly accessible FeatureServer that works with ArcGIS Online.

---

## 5. Option 2: Standalone Koop Server (Most Flexible)

**Best for:** Maximum control, existing infrastructure, any cloud provider, production deployments

Deploy Koop as a standalone Node.js application on any infrastructure.

### Prerequisites

- Node.js 18+ installed
- Access to Databricks SQL Warehouse (via HTTPS)
- Public IP or domain name
- SSL/TLS certificate (Let's Encrypt, etc.)

### Step 1: Install the Provider

```bash
# Create your project
mkdir my-koop-server
cd my-koop-server
npm init -y

# Install dependencies
npm install @koopjs/koop-core
npm install @databricks/koop-provider-databricks
```

### Step 2: Create Server File

```javascript
// server.js
const Koop = require('@koopjs/koop-core')
const databricksProvider = require('@databricks/koop-provider-databricks')

const koop = new Koop()

// Register the Databricks provider
koop.register(databricksProvider)

// Start the server
const port = process.env.PORT || 8080
koop.server.listen(port, () => {
  console.log(`Koop server listening on port ${port}`)
})
```

### Step 3: Configure Environment Variables

```bash
# .env file
DATABRICKS_SERVER_HOSTNAME=your-workspace.cloud.databricks.com
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/your-warehouse-id
DATABRICKS_TOKEN=your-token
PORT=8080
```

### Step 4: Deploy to Your Infrastructure

**Option A: AWS (EC2, ECS, Lambda)**
```bash
# Deploy to EC2
scp -r . ec2-user@your-server:/home/ec2-user/koop-server
ssh ec2-user@your-server
cd koop-server
npm install --production
npm start
```

**Option B: Azure (App Service, Container Instances)**
```bash
# Deploy to Azure App Service
az webapp up --name koop-databricks --resource-group myResourceGroup
```

**Option C: GCP (Compute Engine, Cloud Run)**
```bash
# Deploy to Cloud Run
gcloud run deploy koop-databricks --source .
```

**Option D: Docker**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

### Step 5: Configure HTTPS

Use nginx or a reverse proxy:

```nginx
server {
    listen 443 ssl;
    server_name koop.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Your Public URL

```
https://koop.your-domain.com/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0
```

---

## 6. Option 3: Databricks Model Serving (Advanced)

**Best for:** Advanced users with specific Databricks Model Serving requirements

**Note:** For most users, **Databricks Apps (Option 1)** is simpler and recommended. Use Model Serving only if you have specific requirements that Apps doesn't meet.

### When to Use Model Serving

- You need custom endpoint configuration
- You're already using Model Serving for other workloads
- You have specific networking requirements within Databricks

### Step 1: Create Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "require('http').get('http://localhost:8080/databricks/rest/info', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["npm", "start"]
```

### Step 2: Build and Push Docker Image

```bash
# Build image
docker build -t koop-databricks-provider:latest .

# Tag for Databricks
docker tag koop-databricks-provider:latest \
  <workspace-url>/koop-databricks-provider:latest

# Push to Databricks
docker push <workspace-url>/koop-databricks-provider:latest
```

### Step 3: Create Model Serving Endpoint

```bash
databricks serving-endpoints create \
  --name koop-provider \
  --config '{
    "served_models": [{
      "model_name": "koop-databricks-provider",
      "model_version": "1",
      "workload_size": "Small",
      "scale_to_zero_enabled": false
    }]
  }'
```

Your endpoint will be:
```
https://<workspace-id>.cloud.databricks.com/serving-endpoints/koop-provider
```

---

## 7. Testing the Deployment

### 1. Test Service Info

```bash
curl "https://<your-url>/databricks/rest/info"
```

Expected response:
```json
{
  "currentVersion": 10.51,
  "fullVersion": "10.5.1"
}
```

### 2. Test Layer Metadata

```bash
curl "https://<your-url>/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0?f=json"
```

### 3. Test Query

```bash
curl "https://<your-url>/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?where=1=1&resultRecordCount=5&f=json"
```

See [ARCGIS_TESTING.md](./ARCGIS_TESTING.md) for comprehensive ArcGIS integration testing.

---

## 8. Connecting to ArcGIS Online

Once deployed, you can add your FeatureServer to ArcGIS Online.

### Steps:

1. **Get Your FeatureServer URL:**
   - Databricks Apps: `https://<workspace>.databricksapps.com/<app-id>/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0`
   - Standalone: `https://your-domain.com/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0`
   - Model Serving: `https://<workspace>.cloud.databricks.com/serving-endpoints/<name>/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0`

2. **Add to ArcGIS Online:**
   - Go to [ArcGIS Online](https://www.arcgis.com)
   - Create a new Web Map
   - Click "Add" → "Add Layer from URL"
   - Select **"An ArcGIS Server Web Service"**
   - Paste your FeatureServer URL
   - Click "Add Layer"

3. **Verify:**
   - Features should appear on the map
   - Click features to see attribute pop-ups
   - Test filtering, queries, and spatial operations

---

## Environment Variables

Configure these environment variables in your deployment:

| Variable | Description | Example |
|----------|-------------|---------  |
| `DATABRICKS_SERVER_HOSTNAME` | Workspace hostname | `e2-demo-field-eng.cloud.databricks.com` |
| `DATABRICKS_HTTP_PATH` | SQL Warehouse path | `/sql/1.0/warehouses/428aad03ef2b6b5f` |
| `DATABRICKS_TOKEN` | Authentication token | Use secrets management |
| `LOG_LEVEL` | Logging level | `INFO` or `DEBUG` |
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Server port | `8080` |

**Note:** When running on Databricks Apps, you can use Unity Catalog authentication instead of tokens.

---

## Security Best Practices

1. **Use Service Principal** instead of personal access tokens
2. **Store secrets** in proper secret management (Databricks Secrets, AWS Secrets Manager, etc.)
3. **Grant minimum permissions** (SELECT only on needed tables)
4. **Enable audit logging** in Databricks workspace
5. **Use HTTPS** (automatic with Databricks URLs, configure for standalone)
6. **Rate limiting** - Consider adding rate limits for public endpoints

---

## Additional Resources

- [Databricks Apps Documentation](https://docs.databricks.com/en/apps/index.html)
- [ArcGIS Testing Guide](./ARCGIS_TESTING.md)
- [ArcGIS REST API](https://developers.arcgis.com/rest/services-reference/enterprise/feature-service.htm)
- [Koop Documentation](https://koopjs.github.io/)

---

## Support

For issues or questions:

1. Check [GitHub Issues](https://github.com/koopjs/koop/issues)
2. Review Databricks workspace logs
3. Test queries directly in SQL Editor
4. Verify table schema and geometry format

For ArcGIS-specific questions:
- [ArcGIS Developer Documentation](https://developers.arcgis.com/)
- [ArcGIS Community Forums](https://community.esri.com/)
