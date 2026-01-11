# Koop Provider for Databricks

A [Koop](https://koopjs.github.io/) provider that connects to Databricks SQL endpoints and serves geospatial data as GeoJSON through ArcGIS FeatureServer APIs.

## Overview

This provider enables you to:
- Connect to Databricks SQL warehouses and query geospatial tables
- Expose Databricks data as ArcGIS FeatureServer endpoints
- Support H3 spatial filtering for optimized geospatial queries
- Serve data in GeoJSON format compatible with ArcGIS clients

## Documentation

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
     "geometryColumn": "geometry",
     "spatialReference": 4326,
     "maxRows": 10000
   }
   ```

   Configuration options:
   - `objectId`: Name of the unique identifier column (default: `objectid`)
   - `geometryColumn`: Name of the geometry column (default: `geometry`)
   - `spatialReference`: SRID/WKID for spatial reference (default: `4326` for WGS84)
   - `maxRows`: Maximum number of rows to return per query (default: `10000`)

3. Set the log level (optional):
   ```bash
   export LOG_LEVEL=INFO  # Options: ERROR, WARN, INFO, DEBUG
   ```

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

1. **Geometry Column**: Spatial geometry data in a format supported by Databricks ST functions
   - Supports: GEOMETRY type, WKT strings, or GeoJSON
   - Example: `ST_GeomFromText('POINT(-122.4194 37.7749)', 4326)`
   - The column name should be specified in `config/default.json` (default: `geometry`)

2. **Object ID Column**: Unique identifier for each feature
   - Must be unique and non-null
   - Typically an integer or bigint column
   - The column name should be specified in `config/default.json` (default: `objectid`)

3. **(Optional) H3 Column**: For H3 spatial indexing on large datasets
   - Contains H3 cell indices as strings or long integers
   - Improves performance for spatial queries at scale
   - Use with `h3col` and `h3res` query parameters

### Databricks ST Functions Used

This provider leverages Databricks SQL's native geospatial functions for optimal performance:

- **ST_AsGeoJSON()**: Converts geometry to GeoJSON format directly in the database
- **ST_GeomFromText()**: Parses WKT geometry strings
- **ST_Intersects()**: Spatial intersection testing for bbox queries
- **h3_coverash3()**: H3 spatial indexing for large-scale queries

### Example Table Setup

```sql
CREATE TABLE catalog.schema.cities (
  objectid BIGINT,
  city_name STRING,
  population INT,
  geometry GEOMETRY,
  h3_index STRING  -- Optional: for H3 indexing
)
USING DELTA
LOCATION 's3://your-bucket/cities';

-- Insert data with geometry
INSERT INTO catalog.schema.cities VALUES
  (1, 'San Francisco', 874961,
   ST_GeomFromText('POINT(-122.4194 37.7749)', 4326),
   h3_latlongash3(37.7749, -122.4194, 7));
```

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
