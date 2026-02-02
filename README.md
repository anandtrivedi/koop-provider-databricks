# Koop Provider for Databricks

A [Koop](https://koopjs.github.io/) provider that connects to Databricks SQL endpoints and serves geospatial data as GeoJSON through ArcGIS FeatureServer APIs.

## What's New in v0.2 🎉

Major improvements bringing the provider up to date with modern Koop standards:

✅ **Upgraded to @koopjs/koop-core@10.4.17** - Latest Koop framework (from 3.17.0)
✅ **Multi-Format Geometry Support** - WKT, WKB, GeoJSON, and native GEOMETRY types
✅ **Automatic Geometry Type Detection** - Proper Esri geometry type metadata
✅ **Complete Field Metadata** - DESCRIBE TABLE integration with type mapping
✅ **returnExtentOnly Support** - Fast bounding box queries without fetching features
✅ **Time Filtering** - Temporal queries with `time` and `timeField` parameters
✅ **Metadata Caching** - In-memory caching for improved performance

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.

## Overview

This provider enables you to:
- Connect to Databricks SQL warehouses or general-purpose clusters and query geospatial tables
- Expose Databricks data as ArcGIS FeatureServer endpoints
- Support multiple geometry formats (WKT, WKB, GeoJSON, native GEOMETRY)
- Serve data in GeoJSON format compatible with ArcGIS clients

## Documentation

### Core Guides

- **[Complete Deployment Guide](./DATABRICKS_DEPLOYMENT.md)** - Everything from table preparation to deployment and testing
  - Part 1: Preparing your tables (objectid, geometry_wkt, WKT format)
  - Part 2: Deployment options (Databricks Apps, Docker/Cloud deployment)
  - Part 3: Testing and ArcGIS integration
- **[ArcGIS Testing](./ARCGIS_TESTING.md)** - Detailed testing guide for ArcGIS Online, Pro, and JavaScript API

### External Resources

- [Koop Documentation](https://koopjs.github.io/docs/usage/provider)
- [Koop CLI Documentation](https://github.com/koopjs/koop-cli)
- [Databricks SQL API](https://docs.databricks.com/sql/api/sql-execution-tutorial.html)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Access to a Databricks workspace with SQL warehouse or general-purpose cluster
- Databricks personal access token
- Geospatial table with geometry column (supports WKT, WKB, GeoJSON, or native GEOMETRY)

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/anandtrivedi/koop-provider-databricks.git
   cd koop-provider-databricks
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Quick Start

Get up and running in 3 steps:

### 1. Create Test Data

Run the example script to create a sample table with 10 US cities:

```bash
npm run create-test-data
```

This creates: `main.default.koop_test_cities` with:
- `objectid` (BIGINT) - Unique ID for each city
- `city_name`, `population`, `state` (STRING/INT) - City attributes
- `geometry_wkt` (STRING) - WKT geometry: `'POINT(-122.4194 37.7749)'`
- `srid` (INT) - Spatial reference ID (4326 for WGS84)

### 2. Start the Server

```bash
npm start
```

Server starts on `http://localhost:8080`

### 3. Test in Browser

Open this URL to see your test data as GeoJSON:

```
http://localhost:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?where=1=1&f=geojson
```

You should see 10 US cities as GeoJSON features!

**🎉 Success!** You now have a working Koop provider serving Databricks data as ArcGIS FeatureServer.

---

## Performance Optimization (Optional)

Once your basic setup is working, you can upgrade to **native GEOMETRY format** for best performance:

### Why Upgrade to Native GEOMETRY?

⚡ **2-3x Faster Queries** - No parsing overhead, optimized binary storage
🚀 **Lower Network Usage** - Most compact representation
📊 **Better at Scale** - Handles large datasets more efficiently

### Upgrade Steps

**1. Convert Your WKT Column to Native GEOMETRY:**

```sql
-- Option A: Add new column and populate
ALTER TABLE main.default.my_table ADD COLUMN geometry GEOMETRY;
UPDATE main.default.my_table
SET geometry = ST_GeomFromText(geometry_wkt, 4326);

-- Option B: Create new table with GEOMETRY column
CREATE TABLE main.default.my_table_optimized AS
SELECT
  objectid,
  ST_GeomFromText(geometry_wkt, 4326) as geometry,
  other_columns
FROM main.default.my_table;
```

**2. Update Configuration:**

```json
{
  "objectId": "objectid",
  "geometryColumn": "geometry",
  "geometryFormat": "geometry",
  "spatialReference": 4326,
  "maxRows": 10000
}
```

**3. Restart Server:**

```bash
npm start
```

**Result:** Same functionality, but 2-3x faster queries with no other changes needed!

### When to Use Each Format

| Format | Best For | Performance |
|--------|----------|-------------|
| **WKT** (default) | Getting started, debugging, easy setup | Good ✓ |
| **Native GEOMETRY** | Production, large datasets, performance-critical | Excellent ⚡⚡⚡ |

**📖 See [config/README.md](./config/README.md) for details on all supported geometry formats (WKT, WKB, GeoJSON, native GEOMETRY)**

---

### Configuration

1. Create a `.env` file in the root directory (see `.env.example` for template):
   ```bash
   DATABRICKS_TOKEN=your_personal_access_token
   DATABRICKS_SERVER_HOSTNAME=your_workspace.cloud.databricks.com
   DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/your_warehouse_id
   # Or for general-purpose cluster:
   # DATABRICKS_HTTP_PATH=sql/protocolv1/o/{org-id}/{cluster-id}
   ```

2. Update `config/default.json` with your provider configuration:
   ```json
   {
     "objectId": "objectid",
     "geometryColumn": "geometry_wkt",
     "geometryFormat": "wkt",
     "spatialReference": 4326,
     "maxRows": 10000
   }
   ```

   Configuration options:
   - `objectId`: Name of the unique identifier column (default: `objectid`)
   - `geometryColumn`: Name of the geometry column (default: `geometry_wkt`)
   - `geometryFormat`: Geometry data format - `"wkt"`, `"wkb"`, `"geojson"`, or `"geometry"` (default: `"wkt"`)
   - `spatialReference`: SRID/WKID for spatial reference (default: `4326` for WGS84)
   - `maxRows`: Maximum number of rows to return per query (default: `10000`)

   **📖 See [config/README.md](./config/README.md) for detailed configuration guide with examples**

3. Set the log level (optional):
   ```bash
   export LOG_LEVEL=INFO  # Options: ERROR, WARN, INFO, DEBUG
   ```

### Preparing Your Tables

Your Databricks tables must have two key columns:

1. **ObjectID column** (integer, unique) - Identifies each feature
2. **Geometry column** (string, WKT format) - Stores spatial data

**Quick example:**
```sql
CREATE TABLE my_cities (
  objectid INT,              -- Unique ID
  city_name STRING,
  geometry_wkt STRING        -- WKT: "POINT(-122.4194 37.7749)"
)
```

**If you have existing tables with lat/lon columns:**
```sql
CREATE VIEW my_cities_koop AS
SELECT
  id as objectid,
  CONCAT('POINT(', longitude, ' ', latitude, ')') as geometry_wkt,
  *
FROM my_existing_cities
```

**📖 For complete table preparation guide, see [DATABRICKS_DEPLOYMENT.md - Part 1: Table Preparation](./DATABRICKS_DEPLOYMENT.md#1-preparing-your-tables)**

### Running the Server

Start the development server:
```bash
npm start
```

The server will start on `http://localhost:8080`

## Koop provider file structure

| File | | Description |
| --- | --- | --- |
| `src/index.js` | Mandatory | Configures provider for usage by Koop |
| `src/model.js` | Mandatory | Translates remote API to GeoJSON |
| `src/routes.js` | Optional | Specifies additional routes to be handled by this provider |
| `src/controller.js` | Optional | Handles additional routes specified in `routes.js` |
| `test/model-test.js` | Optional | tests the `getData` function on the model |
| `test/fixtures/input.json` | Optional | a sample of the raw input from the 3rd party API |
| `config/default.json` | Optional | used for advanced configuration, usually API keys. |


## API Usage

### Basic Query

Query features from your Databricks table:

```bash
curl "http://localhost:8080/databricks/rest/services/{catalog}.{schema}.{table}/FeatureServer/0/query"
```

Example:
```bash
curl "http://localhost:8080/databricks/rest/services/geoserverat.default.structures_national_gdb/FeatureServer/0/query"
```

### Get Layer Metadata

Get information about available layers:

```bash
curl "http://localhost:8080/databricks/rest/services/{catalog}.{schema}.{table}/FeatureServer/layers"
```

### Standard Koop Query Parameters

This provider supports all standard Koop/ArcGIS REST API query parameters:

#### Spatial Filtering

**Bounding Box Filter (using ST_Intersects)**
```bash
curl "http://localhost:8080/databricks/rest/services/catalog.schema.table/FeatureServer/0/query?geometry=-122.5,37.7,-122.3,37.9&geometryType=esriGeometryEnvelope"
```

- `geometry`: Bounding box coordinates `xmin,ymin,xmax,ymax`
- `geometryType`: Type of geometry (use `esriGeometryEnvelope` for bbox)

#### Attribute Filtering

**WHERE Clause**
```bash
curl "http://localhost:8080/databricks/rest/services/catalog.schema.table/FeatureServer/0/query?where=population>1000000"
```

- `where`: Standard SQL WHERE clause
- Supports comparisons, LIKE, IN, BETWEEN, etc.

#### Field Selection

**Select Specific Fields**
```bash
curl "http://localhost:8080/databricks/rest/services/catalog.schema.table/FeatureServer/0/query?outFields=city_name,population,state"
```

- `outFields`: Comma-separated list of field names
- Use `*` for all fields (default)

#### Geometry Control

**Exclude Geometry**
```bash
curl "http://localhost:8080/databricks/rest/services/catalog.schema.table/FeatureServer/0/query?returnGeometry=false"
```

- `returnGeometry`: `true` (default) or `false`
- Setting to `false` improves performance for attribute-only queries

#### Pagination

**Limit and Offset**
```bash
curl "http://localhost:8080/databricks/rest/services/catalog.schema.table/FeatureServer/0/query?resultOffset=100&resultRecordCount=50"
```

- `resultOffset`: Number of records to skip (default: 0)
- `resultRecordCount`: Maximum number of records to return (default: 10000)

#### Sorting

**Order Results**
```bash
curl "http://localhost:8080/databricks/rest/services/catalog.schema.table/FeatureServer/0/query?orderByFields=population DESC,city_name ASC"
```

- `orderByFields`: Comma-separated list of fields with optional ASC/DESC

### H3 Spatial Filtering (Advanced)

The provider supports H3-based spatial indexing for optimized geospatial queries on large datasets. This requires:
- A table with an H3 column containing H3 cell indices
- Query parameters: `bbox`, `h3col`, and `h3res`

Example:
```bash
curl "http://localhost:8080/databricks/rest/services/mydb.schema.mytable/FeatureServer/0/query?bbox=-122.5,37.7,-122.3,37.9&h3col=h3_index&h3res=7"
```

Parameters:
- `bbox`: Bounding box in format `minX,minY,maxX,maxY`
- `h3col`: Name of the H3 index column in your table
- `h3res`: H3 resolution level (0-15)

### Combined Query Example

```bash
curl "http://localhost:8080/databricks/rest/services/census.public.cities/FeatureServer/0/query?where=state='California'&geometry=-124.4,32.5,-114.1,42.0&outFields=city_name,population&orderByFields=population DESC&resultRecordCount=10"
```

This query:
- Filters to California cities
- Within a bounding box
- Returns only city name and population
- Orders by population descending
- Limits to top 10 results

## Testing

Run the test suite:
```bash
npm test
```

This will run:
- Code linting with StandardJS
- Unit tests with tape

### Development Mode

Enable detailed error stack traces during development:

```bash
NODE_ENV=test npm start
```

## Data Requirements

Your Databricks table must have:

1. **Geometry Column**: Column containing spatial geometry data in one of the supported formats
   - **Supported formats**: WKT (STRING), WKB (BINARY), GeoJSON (STRING), or native GEOMETRY type
   - **Default format**: WKT text strings (most common, easy to create)
   - Supports: POINT, LINESTRING, POLYGON, MULTIPOINT, MULTILINESTRING, MULTIPOLYGON
   - WKT example: `'POINT(-122.4194 37.7749)'`
   - The column name and format should be specified in `config/default.json` (defaults: `geometry_wkt` column, `wkt` format)
   - **📖 See [config/README.md](./config/README.md) for all supported geometry formats and configuration**

2. **Object ID Column**: Unique identifier for each feature
   - Must be unique and non-null
   - Must be an integer type (INT, BIGINT)
   - The column name should be specified in `config/default.json` (default: `objectid`)

3. **(Optional) H3 Column**: For H3 spatial indexing on large datasets
   - Contains H3 cell indices as strings or long integers
   - Improves performance for spatial queries at scale
   - Use with `h3col` and `h3res` query parameters

### Supported Geometry Types

All WKT geometry types are automatically detected and converted:

```sql
-- Points (cities, markers, facilities)
'POINT(-122.4194 37.7749)'

-- LineStrings (roads, rivers, routes)
'LINESTRING(-122.4 37.8, -122.3 37.7, -122.2 37.6)'

-- Polygons (states, parcels, zones)
'POLYGON((-122.5 37.8, -122.3 37.8, -122.3 37.6, -122.5 37.6, -122.5 37.8))'

-- Multi-geometries also supported
'MULTIPOINT(-122.4 37.7, -122.3 37.6)'
'MULTILINESTRING((-122.4 37.8, -122.3 37.7), (-122.2 37.6, -122.1 37.5))'
'MULTIPOLYGON(((-122.5 37.8, -122.3 37.8, -122.3 37.6, -122.5 37.6, -122.5 37.8)))'
```

### Databricks ST Functions Used

This provider leverages Databricks SQL's native geospatial functions for optimal performance:

- **ST_AsGeoJSON()**: Converts WKT geometry to GeoJSON format directly in the database
- **ST_GeomFromText()**: Validates and parses WKT geometry strings for spatial operations
- **ST_Intersects()**: Spatial intersection testing for bbox queries
- **h3_coverash3()**: H3 spatial indexing for large-scale queries

### Example Table Setup

```sql
CREATE TABLE catalog.schema.cities (
  objectid BIGINT,
  city_name STRING,
  population INT,
  geometry_wkt STRING,  -- WKT geometry as string
  h3_index STRING       -- Optional: for H3 indexing
)
USING DELTA
LOCATION 's3://your-bucket/cities';

-- Insert data with WKT geometry strings
INSERT INTO catalog.schema.cities VALUES
  (1, 'San Francisco', 874961, 'POINT(-122.4194 37.7749)', h3_latlongash3(37.7749, -122.4194, 7)),
  (2, 'Los Angeles', 3979576, 'POINT(-118.2437 34.0522)', h3_latlongash3(34.0522, -118.2437, 7)),
  (3, 'New York', 8336817, 'POINT(-74.0060 40.7128)', h3_latlongash3(40.7128, -74.0060, 7));
```

### If You Have Native GEOMETRY Columns

If your existing tables use Databricks native GEOMETRY type, you have two options:

**Option 1: Use native GEOMETRY directly** ⚡ **BEST PERFORMANCE** (v0.2+):
```sql
-- No conversion needed! Just use your existing table
-- Configure the provider to use native GEOMETRY format
```

Update `config/default.json`:
```json
{
  "geometryColumn": "geometry",
  "geometryFormat": "geometry"
}
```

**Option 2: Convert to WKT** (for compatibility):
```sql
CREATE VIEW catalog.schema.cities_koop AS
SELECT
  objectid,
  city_name,
  population,
  ST_AsText(geometry) as geometry_wkt,  -- Convert GEOMETRY to WKT string
  h3_index
FROM catalog.schema.cities_with_geometry;
```

**📖 See [DATABRICKS_DEPLOYMENT.md - Scenario 2](./DATABRICKS_DEPLOYMENT.md#scenario-2-table-has-native-geometry-column) for more details**

## Common Pitfalls for Beginners

Watch out for these common mistakes when getting started:

### ❌ Pitfall 1: Column Name Mismatch

**Problem:** Layer fails to load with "Column not found" error

**Cause:** The `config/default.json` specifies column names that don't match your actual table

**Example of the problem:**
```json
// Config says:
{
  "objectId": "objectid",
  "geometryColumn": "geometry_wkt"
}

// But your table has:
CREATE TABLE my_table (
  id INT,              -- ❌ Named 'id' not 'objectid'
  geom STRING         -- ❌ Named 'geom' not 'geometry_wkt'
)
```

**Solution:**
Update your config to match your table's actual column names (case-sensitive!):
```json
{
  "objectId": "id",
  "geometryColumn": "geom"
}
```

Or create a view with the expected column names:
```sql
CREATE VIEW my_table_koop AS
SELECT
  id as objectid,
  geom as geometry_wkt,
  *
FROM my_table
```

---

### ❌ Pitfall 2: Geometry Format Configuration

**Problem:** Not sure which geometry format to use or how to configure it

**Answer:** With v0.2+, the provider supports **multiple geometry formats**. Choose what works best for your data:

**Supported Formats:**
- **WKT** (STRING) - Default, human-readable, easy to create
- **WKB** (BINARY) - Binary format, common for PostGIS migrations
- **GeoJSON** (STRING) - JSON format, web-friendly
- **Native GEOMETRY** - Databricks native type, **best performance** ⚡

**Example 1: WKT String (Default)**
```sql
CREATE TABLE my_cities (
  objectid INT,
  city_name STRING,
  geometry_wkt STRING  -- ✅ String with WKT text
)

INSERT INTO my_cities VALUES
  (1, 'San Francisco', 'POINT(-122.4194 37.7749)')  -- ✅ WKT string
```

Config:
```json
{
  "geometryColumn": "geometry_wkt",
  "geometryFormat": "wkt"
}
```

**Example 2: Native GEOMETRY (Best Performance)** ⚡
```sql
CREATE TABLE my_cities (
  objectid INT,
  city_name STRING,
  geometry GEOMETRY    -- ✅ Native Databricks GEOMETRY type (v0.2+)
)

INSERT INTO my_cities VALUES
  (1, 'San Francisco', ST_Point(-122.4194, 37.7749))
```

Config:
```json
{
  "geometryColumn": "geometry",
  "geometryFormat": "geometry"
}
```

**No conversion needed!** With v0.2, you can use existing GEOMETRY columns directly.

**📖 See [config/README.md](./config/README.md) for all format options and performance comparison**

---

### ❌ Pitfall 3: Lat/Lon Order Reversed

**Problem:** Features appear in the wrong location on the map (ocean instead of land, wrong continent, etc.)

**Cause:** WKT uses `(longitude, latitude)` order, NOT `(latitude, longitude)`

**Wrong:**
```sql
-- ❌ WRONG: This is (latitude, longitude)
INSERT INTO cities VALUES (1, 'San Francisco', 'POINT(37.7749 -122.4194)')
-- This would place the city in the Atlantic Ocean!
```

**Correct:**
```sql
-- ✅ RIGHT: This is (longitude, latitude)
INSERT INTO cities VALUES (1, 'San Francisco', 'POINT(-122.4194 37.7749)')
```

**When converting from lat/lon columns:**
```sql
-- ✅ Longitude first, then latitude
CONCAT('POINT(', longitude, ' ', latitude, ')')

-- ❌ NOT this
CONCAT('POINT(', latitude, ' ', longitude, ')')
```

**Remember:** WKT is `(X Y)` = `(longitude latitude)`, not `(Y X)`

---

### ❌ Pitfall 4: Missing or NULL ObjectIDs

**Problem:** Layer loads but features are missing or duplicated

**Cause:** ObjectID column has NULL values or duplicates

**Requirements:**
- ObjectID must be an INTEGER type
- Must be UNIQUE for each row
- Must NOT be NULL
- Should be sequential (1, 2, 3, ...) for best performance

**Check for problems:**
```sql
-- Check for NULLs
SELECT COUNT(*) FROM my_table WHERE objectid IS NULL

-- Check for duplicates
SELECT objectid, COUNT(*) FROM my_table
GROUP BY objectid
HAVING COUNT(*) > 1
```

**Fix with ROW_NUMBER():**
```sql
CREATE VIEW my_table_fixed AS
SELECT
  ROW_NUMBER() OVER (ORDER BY original_id) as objectid,
  *
FROM my_table
```

---

### ❌ Pitfall 5: Forgetting to Configure Environment Variables

**Problem:** Server fails to start with connection errors

**Cause:** Missing or incorrect `.env` file

**Solution:**
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual Databricks credentials:
   ```bash
   DATABRICKS_TOKEN=dapi1234567890abcdef
   DATABRICKS_SERVER_HOSTNAME=my-workspace.cloud.databricks.com
   DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/abc123def456
   ```

3. **Never commit `.env` to git!** It's already in `.gitignore`

---

### ❌ Pitfall 6: Invalid WKT Geometry

**Problem:** Features don't display on the map

**Cause:** WKT geometry is malformed or invalid

**Common WKT mistakes:**
```sql
-- ❌ Missing closing parenthesis
'POINT(-122.4 37.7'

-- ❌ Polygon not closed (first and last point must be the same)
'POLYGON((-122.5 37.8, -122.3 37.8, -122.3 37.6, -122.5 37.6))'

-- ❌ Extra spaces or commas
'POINT( -122.4 , 37.7 )'

-- ✅ Correct formats
'POINT(-122.4194 37.7749)'
'POLYGON((-122.5 37.8, -122.3 37.8, -122.3 37.6, -122.5 37.6, -122.5 37.8))'
```

**Test your WKT:**
```sql
-- This should NOT return NULL
SELECT ST_GeomFromText(geometry_wkt, 4326)
FROM my_table
LIMIT 10

-- Find invalid geometries
SELECT objectid, geometry_wkt
FROM my_table
WHERE ST_GeomFromText(geometry_wkt, 4326) IS NULL
```

---

### 💡 Quick Troubleshooting Checklist

When something doesn't work, check these in order:

1. ✅ Are your environment variables set correctly? (`echo $DATABRICKS_TOKEN`)
2. ✅ Is your SQL Warehouse running? (Check Databricks workspace)
3. ✅ Do column names in config match your table? (Case-sensitive!)
4. ✅ Is your geometry column in a supported format? (WKT, WKB, GeoJSON, or native GEOMETRY type)
5. ✅ Are coordinates in `(longitude, latitude)` order? (Not `(lat, lon)`)
6. ✅ Does every row have a unique, non-NULL objectid? (Check for NULLs and duplicates)
7. ✅ Is your WKT geometry valid? (Test with `ST_GeomFromText`)

---

## Troubleshooting

### Connection Issues

If you encounter connection errors:
- Verify your Databricks credentials in `.env`
- Ensure your SQL warehouse is running
- Check network connectivity to Databricks

### Geometry Parsing Errors

If geometries aren't rendering:
- Verify your geometry column uses Databricks GEOMETRY type or valid WKT
- Test ST_AsGeoJSON() directly: `SELECT ST_AsGeoJSON(geometry) FROM your_table LIMIT 1`
- Ensure geometries are valid: `SELECT ST_IsValid(geometry) FROM your_table`
- Check spatial reference matches configuration

### Performance Issues

For better performance:
- **Use Databricks ST functions**: This provider now uses `ST_AsGeoJSON()` and `ST_Intersects()` for native database processing
- **Add spatial indices**: Create Z-ORDER BY on geometry columns for Delta tables
  ```sql
  OPTIMIZE catalog.schema.table ZORDER BY (geometry)
  ```
- **Use H3 spatial indexing**: For large datasets, add H3 indices and use `h3col`/`h3res` parameters
- **Limit returned fields**: Use `outFields` parameter to request only needed columns
- **Disable geometry when not needed**: Use `returnGeometry=false` for attribute-only queries
- **Enable result caching**: Configure caching in your Databricks SQL warehouse
- **Partition tables**: Use appropriate partitioning strategy for your data
- **Adjust maxRows**: Configure in `config/default.json` based on your use case

## Performance Optimizations

This provider is optimized for performance using Databricks native capabilities:

### Database-Side Processing
- **ST_AsGeoJSON()**: Geometry conversion happens in Databricks, not in Node.js
- **ST_Intersects()**: Spatial filtering executed as native SQL
- **Column selection**: Only requested fields are transferred over the network
- **No client-side WKT parsing**: Eliminated dependencies on wellknown, turf, geojson-rewind

### Query Optimization
```sql
-- Example of optimized query generated by the provider
SELECT city_name, population, ST_AsGeoJSON(geometry) as __geojson__
FROM catalog.schema.cities
WHERE ST_Intersects(geometry, ST_GeomFromText('POLYGON(...)', 4326))
  AND population > 1000000
ORDER BY population DESC
LIMIT 100
```

### Recommended Table Optimizations
```sql
-- Add Z-ORDER clustering on geometry
OPTIMIZE catalog.schema.cities ZORDER BY (geometry);

-- Add H3 indices for large tables
ALTER TABLE catalog.schema.cities
ADD COLUMN h3_7 STRING GENERATED ALWAYS AS (
  h3_latlongash3(ST_Y(ST_Centroid(geometry)), ST_X(ST_Centroid(geometry)), 7)
);

-- Create secondary index on frequently queried columns
CREATE INDEX idx_population ON catalog.schema.cities(population);
```

## Publishing

To publish this provider to npm:

1. Update `package.json` with your information
2. Ensure you're logged in to npm: `npm login`
3. Publish: `npm publish`

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

Apache-2.0
