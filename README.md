# Koop Provider for Databricks

A [Koop](https://koopjs.github.io/) provider that connects to Databricks SQL endpoints and serves geospatial data as GeoJSON through ArcGIS FeatureServer APIs.

## Overview

This provider enables you to:
- Connect to Databricks SQL warehouses and query geospatial tables
- Expose Databricks data as ArcGIS FeatureServer endpoints
- Support H3 spatial filtering for optimized geospatial queries
- Serve data in GeoJSON format compatible with ArcGIS clients

## Documentation

### Core Guides

- **[Complete Deployment Guide](./DATABRICKS_DEPLOYMENT.md)** - Everything from table preparation to deployment and testing
  - Part 1: Preparing your tables (objectid, geometry_wkt, WKT format)
  - Part 2: Deployment options (Databricks Apps, standalone, Model Serving)
  - Part 3: Testing and ArcGIS integration
- **[ArcGIS Testing](./ARCGIS_TESTING.md)** - Detailed testing guide for ArcGIS Online, Pro, and JavaScript API

### External Resources

- [Koop Documentation](https://koopjs.github.io/docs/usage/provider)
- [Koop CLI Documentation](https://github.com/koopjs/koop-cli)
- [Databricks SQL API](https://docs.databricks.com/sql/api/sql-execution-tutorial.html)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Access to a Databricks workspace with SQL warehouse
- Databricks personal access token
- Geospatial table with WKT geometry columns

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

### Configuration

1. Create a `.env` file in the root directory (see `.env.example` for template):
   ```bash
   DATABRICKS_TOKEN=your_personal_access_token
   DATABRICKS_SERVER_HOSTNAME=your_workspace.cloud.databricks.com
   DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/your_warehouse_id
   ```

2. Update `config/default.json` with your provider configuration:
   ```json
   {
     "objectId": "objectid",
     "geometryColumn": "geometry_wkt",
     "spatialReference": 4326,
     "maxRows": 10000
   }
   ```

   Configuration options:
   - `objectId`: Name of the unique identifier column (default: `objectid`)
   - `geometryColumn`: Name of the WKT geometry column (default: `geometry_wkt`)
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

1. **Geometry Column**: STRING column containing WKT (Well-Known Text) format
   - Must be a STRING type containing valid WKT geometry
   - Supports: POINT, LINESTRING, POLYGON, MULTIPOINT, MULTILINESTRING, MULTIPOLYGON
   - Example: `'POINT(-122.4194 37.7749)'`
   - The column name should be specified in `config/default.json` (default: `geometry_wkt`)

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

If your existing tables use Databricks native GEOMETRY type, create a view to convert to WKT strings:

```sql
CREATE VIEW catalog.schema.cities_koop AS
SELECT
  objectid,
  city_name,
  population,
  ST_AsText(geometry) as geometry_wkt,  -- Convert GEOMETRY to WKT string
  h3_index
FROM catalog.schema.cities_with_geometry;

-- Now access via: /databricks/rest/services/catalog.schema.cities_koop/FeatureServer/0
```

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

### ❌ Pitfall 2: WKT vs GEOMETRY Type Confusion

**Problem:** Not sure whether to use STRING or GEOMETRY column type

**Answer:** This provider expects **STRING columns with WKT text**, not native Databricks GEOMETRY type.

**Correct (WKT String):**
```sql
CREATE TABLE my_cities (
  objectid INT,
  city_name STRING,
  geometry_wkt STRING  -- ✅ String with WKT text
)

INSERT INTO my_cities VALUES
  (1, 'San Francisco', 'POINT(-122.4194 37.7749)')  -- ✅ WKT string
```

**Incorrect (Native GEOMETRY):**
```sql
CREATE TABLE my_cities (
  objectid INT,
  city_name STRING,
  geometry GEOMETRY    -- ❌ Native Databricks GEOMETRY type (not supported directly)
)
```

**If you have GEOMETRY columns:** Create a view that converts to WKT strings:
```sql
CREATE VIEW my_cities_koop AS
SELECT
  objectid,
  ST_AsText(geometry) as geometry_wkt,  -- Convert GEOMETRY to WKT string
  *
FROM my_cities
```

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
4. ✅ Is your geometry column a STRING with WKT text? (Not GEOMETRY type)
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
