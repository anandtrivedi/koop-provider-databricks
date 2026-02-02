[← Back to README](./README.md)

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
4. [Standalone Docker/Cloud Deployment](#4-standalone-dockercloud-deployment)

**Part 3: Testing & Integration**
5. [Testing the Deployment](#5-testing-the-deployment)
6. [Connecting to ArcGIS Online](#6-connecting-to-arcgis-online)

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
- Can be one of four supported formats (configured via `geometryFormat` setting):
  - **WKT** (default): STRING column with Well-Known Text, e.g., `'POINT(-122.4 37.8)'`
  - **WKB**: BINARY column with Well-Known Binary data
  - **GeoJSON**: STRING column with GeoJSON text
  - **Native GEOMETRY**: Databricks GEOMETRY type (best performance)
- Must not be NULL for features you want to display
- Column name is configurable (defaults to `geometry_wkt`)

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

| Option | Difficulty | Best For | Detailed Guide |
|--------|-----------|----------|----------------|
| **Render.com** | Easiest | Free tier, automatic HTTPS, zero infrastructure, testing/small prod | [Section 4 - Render.com](#option-d-rendercom-easiest---free-tier-with-auto-https) |
| **Docker Compose** | Easy | Quick local testing, single-command deployment | [Section 4 - Docker](#option-e-docker-deployment-recommended-for-production) |
| **AWS EC2** | Medium | AWS infrastructure, full control, real-world lessons | [Section 4 - AWS](#option-a-aws-ec2-ecs-lambda) |
| **Azure** | Medium | Azure infrastructure, App Service, Container Instances | [Section 4 - Azure](#option-b-azure-app-service-container-instances) |
| **GCP** | Medium | Google Cloud, Cloud Run, Compute Engine | [Section 4 - GCP](#option-c-gcp-compute-engine-cloud-run) |
| **Docker** | Medium | Any cloud platform (AWS ECS, Azure ACI, GCP Cloud Run) | [Section 4 - Docker](#option-e-docker-deployment-recommended-for-production) |
| **Kubernetes** | Medium | Production-ready, auto-scaling, EKS/GKE/AKS/on-prem | [k8s/README.md](./k8s/README.md) |
| **Standalone Node.js** | Medium | Custom hosting, existing infrastructure | [Section 4 - Standalone](#4-standalone-dockercloud-deployment) |

**Quick Recommendations:**

- **Testing/Development**: Docker Compose or Render.com (free tier)
- **Production on AWS**: See [AWS EC2 section below](#aws-ec2-deployment) for real-world lessons, or use [Kubernetes on EKS](./k8s/README.md)
- **Production on Azure/GCP**: Use [Kubernetes deployment](./k8s/README.md) or container services
- **Enterprise on-premises**: Use [Kubernetes](./k8s/README.md) or Docker Swarm

**Why Deploy Standalone?**

- ✅ **Maximum flexibility** - Deploy anywhere (AWS, Azure, GCP, on-prem)
- ✅ **Full control** - Customize networking, authentication, scaling
- ✅ **Integration** - Add to existing infrastructure and workflows
- ✅ **Standard Node.js** - Use any Node.js hosting environment
- ✅ **Works with ArcGIS** - Compatible with all ArcGIS clients (Online, Enterprise, Pro)

---

## 3. Architecture

### High-Level Architecture: Databricks → Koop → ArcGIS

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         END-TO-END DATA FLOW ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                      DATABRICKS LAKEHOUSE                                │
    │                                                                           │
    │  ┌──────────────────────────────────────────────────────────────────┐  │
    │  │  Unity Catalog: catalog.schema.table                             │  │
    │  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │  │
    │  │  │ Delta Table 1  │  │ Delta Table 2  │  │ Delta Table N  │    │  │
    │  │  │                │  │                │  │                │    │  │
    │  │  │ • objectid     │  │ • objectid     │  │ • objectid     │    │  │
    │  │  │ • geometry_wkt │  │ • geometry_wkt │  │ • geometry_wkt │    │  │
    │  │  │ • attributes   │  │ • attributes   │  │ • attributes   │    │  │
    │  │  └────────────────┘  └────────────────┘  └────────────────┘    │  │
    │  └──────────────────────────────────────────────────────────────────┘  │
    │                                  │                                      │
    │                                  │ SQL Queries                          │
    │                                  ▼                                      │
    │  ┌──────────────────────────────────────────────────────────────────┐  │
    │  │              SQL Warehouse (Serverless Compute)                   │  │
    │  │  • Executes SELECT queries with spatial functions                 │  │
    │  │  • ST_AsGeoJSON(), ST_Intersects() for geometry processing        │  │
    │  │  • WHERE clause filtering, pagination (LIMIT/OFFSET)              │  │
    │  └──────────────────────────────────────────────────────────────────┘  │
    └───────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        │ HTTPS with
                                        │ PAT Token or Service Principal
                                        │
                                        ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                  KOOP MIDDLEWARE (Node.js Server)                       │
    │                  Hosted on: AWS/Azure/GCP/Docker/K8s                    │
    │                                                                           │
    │  ┌─────────────────────────────────────────────────────────────────┐   │
    │  │                    Koop Databricks Provider                      │   │
    │  │                                                                   │   │
    │  │  1. Receives FeatureServer REST API requests                     │   │
    │  │  2. Translates to Databricks SQL queries                         │   │
    │  │  3. Executes queries via @databricks/sql SDK                     │   │
    │  │  4. Converts WKT/GEOMETRY → GeoJSON                              │   │
    │  │  5. Formats response as ArcGIS FeatureServer JSON                │   │
    │  │                                                                   │   │
    │  │  Supported Formats:                                               │   │
    │  │  • WKT strings    → GeoJSON                                      │   │
    │  │  • WKB binary     → GeoJSON                                      │   │
    │  │  • GeoJSON text   → GeoJSON                                      │   │
    │  │  • Native GEOMETRY→ GeoJSON                                      │   │
    │  └─────────────────────────────────────────────────────────────────┘   │
    └───────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        │ ArcGIS FeatureServer REST API
                                        │ (HTTPS - Public URL)
                                        │
                                        ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                        ARCGIS ECOSYSTEM                                  │
    │                                                                           │
    │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
    │  │  ArcGIS Online   │  │ ArcGIS Enterprise│  │   ArcGIS Pro     │     │
    │  │                  │  │   (Portal)       │  │   (Desktop)      │     │
    │  │  • Web Maps      │  │  • Web Maps      │  │  • Projects      │     │
    │  │  • Dashboards    │  │  • Dashboards    │  │  • Analysis      │     │
    │  │  • Story Maps    │  │  • Apps          │  │  • Editing       │     │
    │  └──────────────────┘  └──────────────────┘  └──────────────────┘     │
    │                                                                           │
    │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
    │  │ ArcGIS JS API    │  │  ArcGIS REST API │  │  Custom Web Apps │     │
    │  │  (4.x / 3.x)     │  │   Consumers      │  │                  │     │
    │  │  • Web mapping   │  │  • Mobile apps   │  │  • React/Angular │     │
    │  │  • 3D scenes     │  │  • Integrations  │  │  • Python/R      │     │
    │  └──────────────────┘  └──────────────────┘  └──────────────────┘     │
    └─────────────────────────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────────────────────────┐
    │  WHAT GETS EXPOSED:                                                     │
    │  • Each Delta table → One FeatureServer layer                          │
    │  • URL: https://your-url/databricks/rest/services/                     │
    │         catalog.schema.table/FeatureServer/0                           │
    │                                                                          │
    │  QUERIES SUPPORTED:                                                     │
    │  • Spatial filtering (bounding box)                                    │
    │  • Attribute queries (WHERE clauses)                                   │
    │  • Field selection (outFields)                                         │
    │  • Pagination (resultOffset, resultRecordCount)                        │
    │  • Sorting (orderByFields)                                             │
    └────────────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Databricks Lakehouse (Source of Truth)**
   - Delta Tables with geospatial data (WKT, WKB, GeoJSON, or native GEOMETRY columns)
   - Unity Catalog organization (catalog.schema.table)
   - SQL Warehouse for query execution

2. **Koop Middleware (Translation Layer)**
   - Receives ArcGIS FeatureServer REST API requests
   - Translates to Databricks SQL queries
   - Converts geometries to GeoJSON format
   - Handles authentication (PAT or Service Principal)

3. **ArcGIS Ecosystem (Consumers)**
   - ArcGIS Online, Enterprise, Pro
   - JavaScript API, REST API clients
   - Custom web applications

### Data Flow

**Request Flow (ArcGIS → Databricks):**
1. ArcGIS client requests features: `GET /databricks/rest/services/catalog.schema.table/FeatureServer/0/query?where=population>1000000`
2. Koop provider receives request and parses parameters
3. Provider generates SQL query: `SELECT objectid, city_name, ST_AsGeoJSON(geometry) FROM catalog.schema.table WHERE population > 1000000`
4. Query sent to Databricks SQL Warehouse via HTTPS
5. SQL Warehouse executes query on Delta tables

**Response Flow (Databricks → ArcGIS):**
6. Delta table returns rows with GeoJSON geometries
7. Provider formats response as ArcGIS FeatureServer JSON
8. Response sent back to ArcGIS client
9. ArcGIS client renders features on map

### Authentication Options

**Option 1: PAT Token (Quick Start)**
```
Koop ─────[DATABRICKS_TOKEN]────▶ SQL Warehouse
```

**Option 2: Service Principal (Production)**
```
Koop ─────[OAuth2 M2M]────▶ SQL Warehouse
         (Client ID + Secret)
```

---

## 4. Standalone Docker/Cloud Deployment

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
# Or for general-purpose cluster:
# DATABRICKS_HTTP_PATH=sql/protocolv1/o/{org-id}/{cluster-id}
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

**Option D: Render.com (Easiest - Free Tier with Auto HTTPS)**

Render.com provides the easiest deployment with automatic HTTPS and zero infrastructure management. Perfect for testing and small production deployments.

**Prerequisites:**
- GitHub account
- This repository forked or pushed to your GitHub

**Step-by-step:**

1. **Push your code to GitHub** (if not already there)
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Go to [Render.com](https://render.com)** and sign in with GitHub

3. **Create New Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `koop-provider-databricks` repository

4. **Configure the service:**
   ```
   Name: koop-databricks (or your preferred name)
   Region: Choose closest to your users
   Branch: main
   Root Directory: (leave blank)
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   ```

5. **Add environment variables:**

   Click "Advanced" → "Add Environment Variable" and add the following:

   **For PAT Token authentication (Quick Start):**
   ```
   DATABRICKS_SERVER_HOSTNAME = your-workspace.cloud.databricks.com
   DATABRICKS_HTTP_PATH = /sql/1.0/warehouses/your-warehouse-id
   DATABRICKS_TOKEN = dapi1234567890abcdef...
   LOG_LEVEL = INFO
   ```

   **For Service Principal authentication (Production):**
   ```
   DATABRICKS_SERVER_HOSTNAME = your-workspace.cloud.databricks.com
   DATABRICKS_HTTP_PATH = /sql/1.0/warehouses/your-warehouse-id
   DATABRICKS_CLIENT_ID = your-service-principal-app-id
   DATABRICKS_CLIENT_SECRET = your-service-principal-secret
   LOG_LEVEL = INFO
   ```

6. **Select free tier plan:**
   - Instance Type: Free (or choose paid for more resources)
   - The free tier includes:
     - 750 hours/month free
     - Automatic HTTPS
     - Auto-deploy on git push
     - Free SSL certificate

7. **Click "Create Web Service"**

   Render will:
   - Build your application (`npm install`)
   - Start the server (`npm start`)
   - Provide a public URL: `https://your-app-name.onrender.com`

8. **Wait for deployment** (usually 2-3 minutes)

   Watch the logs in the Render dashboard to see build progress.

9. **Test your deployment:**
   ```bash
   # Check service info
   curl "https://your-app-name.onrender.com/databricks/rest/info"

   # Query a table
   curl "https://your-app-name.onrender.com/databricks/rest/services/catalog.schema.table/FeatureServer/0?f=json"
   ```

**Benefits of Render.com:**
- ✅ **Automatic HTTPS** - Free SSL certificates included
- ✅ **Zero infrastructure** - No servers to manage
- ✅ **Auto-deploy** - Updates automatically on git push
- ✅ **Free tier** - 750 hours/month at no cost
- ✅ **Persistent URL** - Get a permanent `.onrender.com` domain
- ✅ **Easy scaling** - Upgrade to paid plans for more resources

**Render.com vs Other Options:**

| Feature | Render.com | AWS EC2 | Docker |
|---------|-----------|---------|--------|
| Setup time | 5 minutes | 30+ minutes | 10 minutes |
| Free tier | ✅ 750 hrs/month | ❌ Expires after 12 months | N/A |
| Auto HTTPS | ✅ Included | ❌ Manual setup | ❌ Manual setup |
| Auto-deploy | ✅ On git push | ❌ Manual | ❌ Manual |
| Best for | Testing, small prod | Production, control | Production, anywhere |

**Troubleshooting:**

If the build fails:
- Check the build logs in Render dashboard
- Verify all environment variables are set
- Ensure `package.json` has correct dependencies
- Check Node.js version compatibility

If queries fail:
- Verify Databricks credentials in environment variables
- Test SQL Warehouse connectivity from logs
- Check firewall rules allow Render IP ranges

**Next Steps:**
Once deployed, your Koop server is accessible at `https://your-app-name.onrender.com`. You can now:
- Add the URL to ArcGIS Online
- Test queries from ArcGIS Pro
- Share the FeatureServer URLs with your team

**Option E: Docker Deployment (Recommended for Production)**

Docker provides the easiest way to deploy Koop with all dependencies pre-configured. This repo includes production-ready Docker files.

#### Quick Start with Docker

**1. Clone the repository:**
```bash
git clone https://github.com/anandtrivedi/koop-provider-databricks.git
cd koop-provider-databricks
```

**2. Create `.env` file:**
```bash
cp .env.example .env
# Edit .env with your Databricks credentials
```

**3. Start with Docker Compose (Easiest):**
```bash
docker-compose up -d
```

That's it! Your Koop server is running at `http://localhost:8080`

#### Docker Compose Configuration

The included `docker-compose.yml` provides a production-ready setup:

```yaml
version: '3.8'

services:
  koop:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - DATABRICKS_SERVER_HOSTNAME=${DATABRICKS_SERVER_HOSTNAME}
      - DATABRICKS_HTTP_PATH=${DATABRICKS_HTTP_PATH}
      - DATABRICKS_TOKEN=${DATABRICKS_TOKEN}
      - PORT=8080
      - LOG_LEVEL=${LOG_LEVEL:-INFO}
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8080/databricks/rest/info', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
```

**Features:**
- ✅ Automatic restart on failure
- ✅ Health checks for container orchestration
- ✅ Environment variable configuration
- ✅ Production-optimized build

#### Manual Docker Commands

If you prefer not to use Docker Compose:

```bash
# Build Docker image
docker build --platform linux/amd64 -t koop-databricks-provider:latest .

# Run container
docker run -d \
  --name koop-databricks-provider \
  -p 8080:8080 \
  -e DATABRICKS_SERVER_HOSTNAME="your-workspace.cloud.databricks.com" \
  -e DATABRICKS_HTTP_PATH="/sql/1.0/warehouses/your-warehouse-id" \
  -e DATABRICKS_TOKEN="your-token" \
  -e LOG_LEVEL="INFO" \
  --restart unless-stopped \
  koop-databricks-provider:latest

# Check logs
docker logs -f koop-databricks-provider

# Test the server
curl "http://localhost:8080/databricks/rest/info"
```

**For general-purpose cluster instead of SQL Warehouse:**
```bash
-e DATABRICKS_HTTP_PATH="sql/protocolv1/o/YOUR_ORG_ID/YOUR_CLUSTER_ID"
```

#### Docker Management Commands

```bash
# View logs
docker-compose logs -f

# Stop the service
docker-compose down

# Restart after changes
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# Check container health
docker ps
docker inspect koop-databricks-provider | grep -A 10 Health
```

#### Deploying to Container Platforms

The Docker image can be deployed to any container platform:

**AWS ECS/Fargate:**
```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag koop-databricks-provider:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/koop:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/koop:latest

# Deploy to ECS (configure task definition with environment variables)
```

**Azure Container Instances:**
```bash
# Create container group
az container create \
  --resource-group myResourceGroup \
  --name koop-server \
  --image koop-databricks-provider:latest \
  --ports 8080 \
  --environment-variables \
    DATABRICKS_SERVER_HOSTNAME='your-workspace.cloud.databricks.com' \
    DATABRICKS_HTTP_PATH='/sql/1.0/warehouses/your-warehouse-id' \
  --secure-environment-variables \
    DATABRICKS_TOKEN='your-token'
```

**Google Cloud Run:**
```bash
# Push to GCR
docker tag koop-databricks-provider:latest gcr.io/your-project/koop:latest
docker push gcr.io/your-project/koop:latest

# Deploy
gcloud run deploy koop \
  --image gcr.io/your-project/koop:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABRICKS_SERVER_HOSTNAME=your-workspace.cloud.databricks.com \
  --set-env-vars DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/your-warehouse-id \
  --set-secrets DATABRICKS_TOKEN=databricks-token:latest
```

**Kubernetes:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: koop-databricks
spec:
  replicas: 3
  selector:
    matchLabels:
      app: koop
  template:
    metadata:
      labels:
        app: koop
    spec:
      containers:
      - name: koop
        image: koop-databricks-provider:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABRICKS_SERVER_HOSTNAME
          value: "your-workspace.cloud.databricks.com"
        - name: DATABRICKS_HTTP_PATH
          value: "/sql/1.0/warehouses/your-warehouse-id"
        - name: DATABRICKS_TOKEN
          valueFrom:
            secretKeyRef:
              name: databricks-secrets
              key: token
        livenessProbe:
          httpGet:
            path: /databricks/rest/info
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: koop-service
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8080
  selector:
    app: koop
```

**Docker Swarm:**
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml koop-stack

# Scale service
docker service scale koop-stack_koop=3
```

#### Dockerfile Explained

The included `Dockerfile` is optimized for production:

```dockerfile
# Multi-arch support (works on M1/M2 Macs and x86)
FROM --platform=linux/amd64 node:18-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (includes Koop CLI needed for runtime)
RUN npm install

# Bundle app source
COPY . .

# Set environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/databricks/rest/info', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD [ "npm", "start" ]
```

**Key features:**
- ✅ Alpine Linux base (small image size)
- ✅ Includes Koop CLI (required for runtime)
- ✅ Health check endpoint
- ✅ Multi-architecture support
- ✅ Production environment settings

#### Troubleshooting Docker Deployment

**Container exits immediately:**
```bash
# Check logs
docker logs koop-databricks-provider

# Common issues:
# 1. Missing environment variables
# 2. Invalid Databricks credentials
# 3. Port 8080 already in use
```

**Cannot connect to Databricks:**
```bash
# Test connectivity from inside container
docker exec -it koop-databricks-provider sh
apk add curl
curl -I https://${DATABRICKS_SERVER_HOSTNAME}
```

**Health check failing:**
```bash
# Check if server is responding
docker exec koop-databricks-provider wget -O- http://localhost:8080/databricks/rest/info
```

**Performance issues:**
```bash
# Increase container resources in docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G
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

---

## 5. Testing the Deployment

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

See [Section 6 - Testing with ArcGIS](#6-testing-with-arcgis-clients) below for comprehensive ArcGIS integration testing.

---

## 6. Connecting to ArcGIS Online

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

Configure these environment variables in your deployment.

### Databricks Authentication - Choose ONE Option

**Option 1: PAT Token (Quick Start - for development/testing)**

| Variable | Description | Example |
|----------|-------------|---------  |
| `DATABRICKS_TOKEN` | Personal Access Token | `dapi1234567890abcdef...` |

**Option 2: Service Principal (Production - recommended)**

| Variable | Description | Example |
|----------|-------------|---------  |
| `DATABRICKS_CLIENT_ID` | Service Principal Application ID | `your-service-principal-app-id` |
| `DATABRICKS_CLIENT_SECRET` | Service Principal Secret | `your-service-principal-secret` |

**Why use Service Principal for production?**
- ✅ No personal credentials tied to individual users
- ✅ Doesn't expire when user accounts change
- ✅ Better audit trail and security
- ✅ Recommended for production deployments

### Connection Settings (Required for both authentication options)

| Variable | Description | Example |
|----------|-------------|---------  |
| `DATABRICKS_SERVER_HOSTNAME` | Workspace hostname | `your-workspace.cloud.databricks.com` |
| `DATABRICKS_HTTP_PATH` | SQL Warehouse path | `/sql/1.0/warehouses/your-warehouse-id` |

### Optional Settings

| Variable | Description | Example |
|----------|-------------|---------  |
| `LOG_LEVEL` | Logging level | `INFO` or `DEBUG` |
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Server port | `8080` |

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
- [ArcGIS REST API](https://developers.arcgis.com/rest/services-reference/enterprise/feature-service.htm)
- [Koop Documentation](https://koopjs.github.io/)
- [Kubernetes Deployment Guide](./k8s/README.md)

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
