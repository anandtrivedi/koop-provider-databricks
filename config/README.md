[← Back to README](../README.md) | [Deployment Guide](../DATABRICKS_DEPLOYMENT.md)

# Configuration Guide

This directory contains the configuration file `default.json` that controls how the Koop Databricks Provider behaves.

## Configuration File: default.json

```json
{
  "objectId": "objectid",
  "geometryColumn": "geometry_wkt",
  "geometryFormat": "wkt",
  "spatialReference": 4326,
  "maxRows": 10000
}
```

---

## Configuration Parameters

### 1. `objectId` (default: `"objectid"`)

**What it does:** Specifies the name of the column that contains unique identifiers for each feature.

**Requirements:**
- Must be an INTEGER type (INT, BIGINT, etc.)
- Must be unique for each row (no duplicates)
- Must not be NULL
- Should be sequential starting from 1 for best performance

**When to change:**
- Your table uses a different column name like `id`, `feature_id`, `gid`, `fid`, etc.

**Examples:**

```json
// If your table has a column named "feature_id"
{
  "objectId": "feature_id"
}

// If your table has a column named "id"
{
  "objectId": "id"
}

// If your table has a column named "gid" (common in PostGIS migrations)
{
  "objectId": "gid"
}
```

**Can also be set via environment variable:**
```bash
export OBJECT_ID_COLUMN="feature_id"
```

---

### 2. `geometryColumn` (default: `"geometry_wkt"`)

**What it does:** Specifies the **name of the column** that contains geometry data.

**Important:** The column name is independent of the data format. The actual data type and format of this column are determined by the `geometryFormat` parameter (see below).

**Requirements:**
- Column must exist in your table
- Column must not be NULL for features you want to display
- Data type depends on `geometryFormat`:
  - `geometryFormat: "wkt"` → Column must be STRING with WKT text
  - `geometryFormat: "wkb"` → Column must be BINARY with WKB data
  - `geometryFormat: "geojson"` → Column must be STRING with GeoJSON text
  - `geometryFormat: "geometry"` → Column must be native GEOMETRY type

**When to change:**
- Your table uses a different column name like `geometry`, `geom`, `wkt`, `shape`, etc.

**Examples:**

```json
// Example 1: Column named "geometry_wkt" with WKT text data (default)
{
  "geometryColumn": "geometry_wkt",
  "geometryFormat": "wkt"
}

// Example 2: Column named "geometry" with native GEOMETRY type
{
  "geometryColumn": "geometry",
  "geometryFormat": "geometry"
}

// Example 3: Column named "geom" with WKB binary data
{
  "geometryColumn": "geom",
  "geometryFormat": "wkb"
}

// Example 4: Column named "shape" with WKT text (ArcGIS migrations)
{
  "geometryColumn": "shape",
  "geometryFormat": "wkt"
}

// Example 5: Column named "geo_json" with GeoJSON string data
{
  "geometryColumn": "geo_json",
  "geometryFormat": "geojson"
}
```

**Key Point:** You can name your geometry column anything you want! Just set `geometryColumn` to match your column name, and set `geometryFormat` to match the data type stored in that column.

**Can also be set via environment variable:**
```bash
export GEOMETRY_COLUMN="geom"
```

---

### 3. `geometryFormat` (default: `"wkt"`)

**What it does:** Specifies the format of geometry data stored in the geometry column.

**Supported formats (by performance):**
- `"geometry"` - **Native Databricks GEOMETRY** ⚡ **FASTEST** - No parsing needed, optimized binary storage
- `"wkb"` - **Well-Known Binary** ⚡ **FAST** - Binary format, requires ST_GeomFromWKB() conversion
- `"wkt"` - **Well-Known Text** (default) - Text format, requires ST_GeomFromText() conversion, human-readable
- `"geojson"` - **GeoJSON** - JSON text format, requires ST_GeomFromGeoJSON() conversion, verbose

**Performance Hierarchy:**
```
FASTEST → SLOWEST
Native GEOMETRY > WKB > WKT > GeoJSON
```

**Default is WKT** for ease of use and compatibility, but **use native GEOMETRY for best performance** when possible.

**IMPORTANT:** You don't need to convert your existing tables! Just create a VIEW with the required columns (`objectid` and your geometry column), then configure `geometryFormat` to match your data. The provider handles all format conversion automatically using Databricks ST functions.

**When to change:**
- Your table uses WKB binary format instead of WKT text
- Your table has GeoJSON strings stored as text
- Your table has native Databricks GEOMETRY type columns

**Examples:**

```json
// For WKT text format (default - most common)
{
  "geometryFormat": "wkt"
}

// For WKB binary format
{
  "geometryFormat": "wkb"
}

// For GeoJSON string format
{
  "geometryFormat": "geojson"
}

// For native Databricks GEOMETRY type
{
  "geometryFormat": "geometry"
}
```

**Can also be set via environment variable:**
```bash
export GEOMETRY_FORMAT="wkb"
```

#### Format Details:

**Native GEOMETRY - ⚡ BEST PERFORMANCE:**
- **Column type:** GEOMETRY (Databricks native spatial type)
- **Example data:** Created with `ST_Point(-122.4194, 37.7749)` or `ST_GeomFromText('POINT(-122.4194 37.7749)')`
- **Use when:** Maximum performance is required
- **Performance:** No parsing overhead, direct use with ST functions, optimized binary storage
- **Storage:** Most compact representation
- **Recommended for:** Large datasets, production deployments where performance matters

**WKB (Well-Known Binary) - ⚡ FAST:**
- **Column type:** BINARY
- **Example data:** Binary blob representing geometry (e.g., `X'0101000000000000000000F0BF0000000000000040'`)
- **Use when:** Geometry is stored as binary data
- **Performance:** Fast - requires ST_GeomFromWKB() conversion once per query
- **Storage:** Compact binary format, more efficient than text
- **Common use cases:**
  - Migrating from PostGIS (stores geometries as WKB by default)
  - Loading data from binary geospatial file formats (Shapefiles, GeoPackage)
  - High-performance applications where binary is more efficient than text
  - Systems that already generate WKB output

**WKT (Well-Known Text) - Default:**
- **Column type:** STRING
- **Example data:** `'POINT(-122.4194 37.7749)'`
- **Use when:** Geometry is stored as text strings, ease of use and compatibility
- **Performance:** Moderate - requires ST_GeomFromText() conversion and text parsing
- **Storage:** Human-readable text format, larger than binary formats
- **Why default:** Most common format, easy to create and debug, widely compatible
- **Recommended for:** Getting started, debugging, data from external sources

**GeoJSON:**
- **Column type:** STRING
- **Example data:** `'{"type":"Point","coordinates":[-122.4194,37.7749]}'`
- **Use when:** Geometry is stored as GeoJSON text
- **Performance:** Moderate - requires ST_GeomFromGeoJSON() conversion and JSON parsing
- **Storage:** Most verbose format (JSON text), largest storage footprint
- **Common format** for web applications and JavaScript
- **Widely used** in modern mapping libraries and APIs

#### Example Table Schemas:

**WKT Format (default):**
```sql
CREATE TABLE my_cities_wkt (
  objectid INT,
  city_name STRING,
  geometry_wkt STRING  -- 'POINT(-122.4194 37.7749)'
)
```

**WKB Format:**
```sql
CREATE TABLE my_cities_wkb (
  objectid INT,
  city_name STRING,
  geometry_wkb BINARY  -- Binary WKB data
)
```

**GeoJSON Format:**
```sql
CREATE TABLE my_cities_geojson (
  objectid INT,
  city_name STRING,
  geometry_geojson STRING  -- '{"type":"Point","coordinates":[-122.4194,37.7749]}'
)
```

**Native GEOMETRY Format:**
```sql
CREATE TABLE my_cities_geometry (
  objectid INT,
  city_name STRING,
  geometry GEOMETRY  -- Native Databricks GEOMETRY type
)
```

#### Converting Between Formats:

**WKT to GEOMETRY:**
```sql
CREATE TABLE my_table_geometry AS
SELECT
  objectid,
  ST_GeomFromText(geometry_wkt, 4326) as geometry,
  other_columns
FROM my_table_wkt
```

**GEOMETRY to WKT:**
```sql
CREATE TABLE my_table_wkt AS
SELECT
  objectid,
  ST_AsText(geometry) as geometry_wkt,
  other_columns
FROM my_table_geometry
```

**WKB to GEOMETRY:**
```sql
CREATE TABLE my_table_geometry AS
SELECT
  objectid,
  ST_GeomFromWKB(geometry_wkb) as geometry,
  other_columns
FROM my_table_wkb
```

**GEOMETRY to WKB:**
```sql
CREATE TABLE my_table_wkb AS
SELECT
  objectid,
  ST_AsBinary(geometry) as geometry_wkb,
  other_columns
FROM my_table_geometry
```

**GeoJSON to GEOMETRY:**
```sql
CREATE TABLE my_table_geometry AS
SELECT
  objectid,
  ST_GeomFromGeoJSON(geometry_geojson) as geometry,
  other_columns
FROM my_table_geojson
```

**GEOMETRY to GeoJSON:**
```sql
CREATE TABLE my_table_geojson AS
SELECT
  objectid,
  ST_AsGeoJSON(geometry) as geometry_geojson,
  other_columns
FROM my_table_geometry
```

---

### 4. `spatialReference` (default: `4326`)

**What it does:** Specifies the Spatial Reference System Identifier (SRID) / Well-Known ID (WKID) for the coordinate system used in your geometries.

**Common values:**
- `4326` - **WGS84 (World Geodetic System 1984)** - Latitude/Longitude in degrees - **MOST COMMON**
- `3857` - **Web Mercator** - Used by Google Maps, OpenStreetMap, web mapping applications
- `2163` - **US National Atlas Equal Area** - US-focused projection
- `4269` - **NAD83** - North American Datum 1983
- Custom SRID - Any valid EPSG code for your projection

**When to change:**
- Your coordinates are in a different coordinate system
- You're working with projected coordinates (meters/feet instead of degrees)
- Your data uses a regional or national coordinate system

**Examples:**

```json
// For WGS84 latitude/longitude (most common - web maps, GPS)
{
  "spatialReference": 4326
}

// For Web Mercator (Google Maps, Leaflet, etc.)
{
  "spatialReference": 3857
}

// For US National Atlas Equal Area
{
  "spatialReference": 2163
}

// For custom projection
{
  "spatialReference": 32610  // UTM Zone 10N
}
```

**Can also be set via environment variable:**
```bash
export SPATIAL_REFERENCE="3857"
```

**How to determine your SRID:**
1. Check your data source documentation
2. Look at existing geometry metadata
3. If using lat/lon in degrees, it's probably 4326
4. If using meters/feet, check regional projection systems
5. Search [EPSG.io](https://epsg.io/) for your region

---

### 5. `maxRows` (default: `10000`)

**What it does:** Controls the maximum number of features returned in a single query response.

**Why it matters:**
- **Prevents overwhelming the server** with massive queries
- **Enables pagination** - ArcGIS clients automatically request more data as needed
- **Balances performance vs responsiveness** - smaller = faster initial load, more requests

**How pagination works:**
- Client requests data with `resultOffset` and `resultRecordCount` parameters
- Server returns up to `maxRows` features per request
- ArcGIS clients handle pagination automatically
- Users see all features - they won't notice the difference

**When to increase `maxRows`:**
- You have powerful hardware (lots of RAM, fast CPU)
- Clients need more data per request to reduce round-trips
- Network latency is high (fewer requests = better)
- You have fast SQL Warehouse and optimized tables

**When to decrease `maxRows`:**
- Queries are timing out or running out of memory
- You want faster initial response times
- Limited server resources
- Very large geometries (polygons with many vertices)

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

// For blazing fast responses (many small requests)
{
  "maxRows": 500
}

// No practical limit (use with caution!)
{
  "maxRows": 999999999
}
```

**Can also be set via environment variable:**
```bash
export MAX_ROWS="5000"
```

**Performance Tips:**
- Start with default (10000) and adjust based on actual performance
- Monitor SQL Warehouse query times
- Larger polygons = use smaller maxRows
- Simple points = can use larger maxRows
- Test with your specific data and hardware

---

## Environment Variable Overrides

All configuration values can be overridden using environment variables without editing the config file:

```bash
# Override all settings via environment variables
export OBJECT_ID_COLUMN="feature_id"
export GEOMETRY_COLUMN="geom"
export GEOMETRY_FORMAT="wkb"
export SPATIAL_REFERENCE="3857"
export MAX_ROWS="5000"

# Start the server
npm start
```

**Priority:** Environment variables > config/default.json > built-in defaults

---

## Complete Examples

### Example 1: Standard WGS84 Point Data

**Table schema:**
```sql
CREATE TABLE my_cities (
  objectid INT,
  city_name STRING,
  population BIGINT,
  geometry_wkt STRING  -- 'POINT(-122.4194 37.7749)'
)
```

**Configuration:**
```json
{
  "objectId": "objectid",
  "geometryColumn": "geometry_wkt",
  "spatialReference": 4326,
  "maxRows": 10000
}
```

---

### Example 2: PostGIS Migration with Custom Column Names

**Table schema:**
```sql
CREATE TABLE parcels (
  gid INT,
  parcel_id STRING,
  owner STRING,
  geom STRING  -- WKT polygon
)
```

**Configuration:**
```json
{
  "objectId": "gid",
  "geometryColumn": "geom",
  "spatialReference": 4326,
  "maxRows": 5000
}
```

---

### Example 3: Web Mercator Projected Data

**Table schema:**
```sql
CREATE TABLE facilities (
  id INT,
  facility_name STRING,
  shape STRING  -- Web Mercator coordinates
)
```

**Configuration:**
```json
{
  "objectId": "id",
  "geometryColumn": "shape",
  "spatialReference": 3857,
  "maxRows": 10000
}
```

---

### Example 4: Large Dataset with Memory Constraints

**Table schema:**
```sql
CREATE TABLE nationwide_parcels (
  objectid BIGINT,
  boundary_wkt STRING  -- Large polygons
)
```

**Configuration:**
```json
{
  "objectId": "objectid",
  "geometryColumn": "boundary_wkt",
  "spatialReference": 4326,
  "maxRows": 1000
}
```

---

## Troubleshooting

### Error: "Column not found: objectid"

**Cause:** Config specifies a column name that doesn't exist in your table

**Solution:**
1. Check your table schema: `DESCRIBE TABLE catalog.schema.table`
2. Update config to match actual column name
3. Or create a view with the expected column name

### Error: "Invalid WKT"

**Cause:** geometryColumn contains invalid WKT format

**Solution:**
1. Verify WKT format: `SELECT ST_GeomFromText(geometry_wkt, 4326) FROM table LIMIT 10`
2. Check for NULL values
3. Ensure longitude/latitude order (not lat/lon)

### Error: "Query timeout"

**Cause:** maxRows is too high for your dataset/hardware

**Solution:**
1. Reduce maxRows: try 5000, 1000, or even 500
2. Optimize your Delta table: `OPTIMIZE table ZORDER BY (objectid)`
3. Add indexes on frequently queried columns

---

## Multi-Table Considerations

### ⚠️ Important Limitation: Global Configuration

**The configuration is GLOBAL for the entire Koop server instance.** All tables served by the same Koop instance must use the same configuration values:

- Same `geometryColumn` name
- Same `geometryFormat` type
- Same `objectId` column name
- Same `spatialReference`
- Same `maxRows`

**This means:**

❌ **NOT SUPPORTED:** One table with `geometry_wkt` column and another with `shape` column
❌ **NOT SUPPORTED:** One table with WKT format and another with WKB format
❌ **NOT SUPPORTED:** One table with `objectid` and another with `feature_id`

### Workarounds for Mixed Schemas

If you have tables with different column names or formats, you have three options:

#### Option 1: Create VIEWs to Normalize (Recommended)

Create views that rename columns to match your configuration. This is the simplest and most flexible approach.

**Example: Different geometry column names**

```sql
-- Original tables
-- Table 1: Has 'geometry_wkt' column
-- Table 2: Has 'shape' column
-- Table 3: Has 'geom' column

-- Configure Koop to use 'geometry_wkt'
-- Then create views for tables that don't match:

CREATE VIEW my_table2_normalized AS
SELECT
  objectid,
  shape AS geometry_wkt,  -- Rename to match config
  other_columns
FROM my_table2;

CREATE VIEW my_table3_normalized AS
SELECT
  objectid,
  geom AS geometry_wkt,   -- Rename to match config
  other_columns
FROM my_table3;

-- Now expose:
-- - main.schema.my_table1 (already has geometry_wkt)
-- - main.schema.my_table2_normalized
-- - main.schema.my_table3_normalized
```

**Example: Different geometry formats**

```sql
-- Original tables
-- Table 1: Has WKT text in 'geometry_wkt' column
-- Table 2: Has WKB binary in 'geometry_wkb' column
-- Table 3: Has native GEOMETRY in 'geometry' column

-- Configure Koop for WKT format
-- Create views to convert other formats to WKT:

CREATE VIEW my_table2_normalized AS
SELECT
  objectid,
  ST_AsText(ST_GeomFromWKB(geometry_wkb)) AS geometry_wkt,  -- Convert WKB → WKT
  other_columns
FROM my_table2;

CREATE VIEW my_table3_normalized AS
SELECT
  objectid,
  ST_AsText(geometry) AS geometry_wkt,  -- Convert GEOMETRY → WKT
  other_columns
FROM my_table3;
```

**Example: Different objectid column names**

```sql
-- Table 1: Has 'objectid' column
-- Table 2: Has 'feature_id' column
-- Table 3: Has 'gid' column

-- Configure Koop to use 'objectid'
-- Create views for tables that don't match:

CREATE VIEW my_table2_normalized AS
SELECT
  feature_id AS objectid,  -- Rename to match config
  geometry_wkt,
  other_columns
FROM my_table2;

CREATE VIEW my_table3_normalized AS
SELECT
  gid AS objectid,  -- Rename to match config
  geometry_wkt,
  other_columns
FROM my_table3;
```

#### Option 2: Deploy Multiple Koop Instances

Deploy separate Koop server instances with different configurations. Each instance can serve tables with a different schema.

**Example deployment:**

```bash
# Instance 1: WKT format tables on port 8080
PORT=8080 GEOMETRY_FORMAT=wkt npm start

# Instance 2: WKB format tables on port 8081
PORT=8081 GEOMETRY_FORMAT=wkb GEOMETRY_COLUMN=geom npm start

# Instance 3: Native GEOMETRY format tables on port 8082
PORT=8082 GEOMETRY_FORMAT=geometry GEOMETRY_COLUMN=geometry npm start
```

**Pros:**
- Each instance optimized for specific table schemas
- Can use different performance settings (maxRows) per instance
- Isolates failures - one instance crashing doesn't affect others

**Cons:**
- More infrastructure to manage
- Higher resource usage
- More complex deployment

#### Option 3: Standardize Your Tables

Modify all tables to use the same column names and formats. This is the cleanest long-term solution.

**Example standardization:**

```sql
-- Standardize all tables to use:
-- - objectid (INT column)
-- - geometry_wkt (STRING column with WKT text)
-- - WGS84 (SRID 4326)

-- For tables with different column names:
ALTER TABLE my_table2 RENAME COLUMN feature_id TO objectid;
ALTER TABLE my_table2 RENAME COLUMN shape TO geometry_wkt;

-- For tables with different formats (convert to WKT):
ALTER TABLE my_table3 ADD COLUMN geometry_wkt STRING;
UPDATE my_table3 SET geometry_wkt = ST_AsText(geometry);
ALTER TABLE my_table3 DROP COLUMN geometry;
```

**Pros:**
- Simplest configuration (everything matches)
- Best performance (no conversion overhead from views)
- Easier to maintain

**Cons:**
- Requires modifying existing tables
- May break other applications using those tables
- One-time migration effort

### Recommendation

For most users, **Option 1 (VIEWs)** is the best choice because:
- ✅ No modification of original tables
- ✅ Other applications continue to work unchanged
- ✅ Flexible - easy to adjust later
- ✅ Good performance (conversion happens in Databricks, not Koop)
- ✅ Can mix and match formats as needed

---

## Additional Resources

- [DATABRICKS_DEPLOYMENT.md](../DATABRICKS_DEPLOYMENT.md) - Complete deployment guide
- [Well-Known Text (WKT) Specification](https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry)
- [EPSG Spatial Reference Codes](https://epsg.io/)
- [Databricks Spatial Functions](https://docs.databricks.com/sql/language-manual/sql-ref-functions-builtin.html#spatial-functions)
