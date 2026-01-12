# Configuration Guide

This directory contains the configuration file `default.json` that controls how the Koop Databricks Provider behaves.

## Configuration File: default.json

```json
{
  "objectId": "objectid",
  "geometryColumn": "geometry_wkt",
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

**What it does:** Specifies the name of the column that contains WKT (Well-Known Text) geometry strings.

**Requirements:**
- Must be a STRING type
- Must contain valid WKT format text
- Must not be NULL for features you want to display

**Supported WKT formats:**
- `POINT(longitude latitude)` - Single location
- `LINESTRING(lon1 lat1, lon2 lat2, ...)` - Path or route
- `POLYGON((lon1 lat1, lon2 lat2, ..., lon1 lat1))` - Area or boundary
- `MULTIPOINT`, `MULTILINESTRING`, `MULTIPOLYGON` - Collections

**When to change:**
- Your table uses a different column name like `geometry`, `geom`, `wkt`, `shape`, etc.

**Examples:**

```json
// If your table has a column named "geometry"
{
  "geometryColumn": "geometry"
}

// If your table has a column named "geom"
{
  "geometryColumn": "geom"
}

// If your table has a column named "shape" (common in ArcGIS migrations)
{
  "geometryColumn": "shape"
}
```

**Can also be set via environment variable:**
```bash
export GEOMETRY_COLUMN="geom"
```

**Important Note:**
This provider expects **STRING columns with WKT text**, not native Databricks GEOMETRY type. If your table has a GEOMETRY column, create a view that converts it:

```sql
CREATE VIEW my_table_koop AS
SELECT
  objectid,
  ST_AsText(geometry) as geometry_wkt,  -- Convert GEOMETRY to WKT string
  *
FROM my_table_with_geometry
```

---

### 3. `spatialReference` (default: `4326`)

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

### 4. `maxRows` (default: `10000`)

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

## Additional Resources

- [DATABRICKS_DEPLOYMENT.md](../DATABRICKS_DEPLOYMENT.md) - Complete deployment guide
- [Well-Known Text (WKT) Specification](https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry)
- [EPSG Spatial Reference Codes](https://epsg.io/)
- [Databricks Spatial Functions](https://docs.databricks.com/sql/language-manual/sql-ref-functions-builtin.html#spatial-functions)
