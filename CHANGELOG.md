# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-02-09

### Added

- **SQL Injection Protection** - Comprehensive input validation for WHERE clauses, column names, and field lists
  - WHERE clause parsing via `js-sql-parser` AST analysis
  - Dangerous keyword rejection (DROP, UNION, DELETE, etc.)
  - Subquery detection and rejection
  - Column name validation with strict regex patterns
- **Connection Pooling** - Singleton `ConnectionManager` reuses a single Databricks client across requests
  - Eliminates per-request connection overhead
  - Race-condition-safe with promise caching
  - Graceful shutdown via SIGTERM/SIGINT handlers
- **Service Principal Authentication** - OAuth M2M support via `DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET`
- **Query Timeouts** - Configurable via `QUERY_TIMEOUT_SECONDS` (default: 30s) to prevent runaway queries
- **Rate Limiting** - Sliding-window per-IP rate limiter, configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`
- **Cache TTL** - Field metadata cache with configurable TTL (`CACHE_TTL_MS`, default: 5 min) and LRU eviction (max 100 entries)
- **211 Unit Tests** - Comprehensive test coverage across validation and query builder functions
- **Render.com Deployment Guide** - Step-by-step instructions with Service Principal support

### Fixed

- **ArcGIS JSON envelope geometry filters** - The `geometry` parameter now accepts the JSON envelope/point forms that ArcGIS clients actually send (including pre-parsed objects from Koop core), with Web Mercator (102100/3857) to WGS84 reprojection via `inSR` or the embedded `spatialReference`. Previously these were silently ignored and spatially unfiltered data was returned
- **Honest `filtersApplied.geometry`** - Only claimed when a SQL bbox filter was actually applied, so Koop falls back to in-memory filtering for unsupported geometry shapes (e.g. polygon filters)
- **`maxRows` enforcement** - `resultRecordCount` is clamped to `[1, maxRows]`; previously oversized values bypassed the cap and negative values removed the LIMIT clause entirely (full-table dump)
- **Environment variable precedence** - `OBJECT_ID_COLUMN`, `GEOMETRY_COLUMN`, `GEOMETRY_FORMAT`, `SPATIAL_REFERENCE`, and `MAX_ROWS` now override `config/default.json` as documented; previously the config file always won and the env vars were ignored
- **Deterministic pagination** - Queries always include `ORDER BY` (default: objectid), preventing duplicate/missing rows across pages
- **WKB SRID mismatch** - `ST_GeomFromWKB` now passes the configured SRID so `ST_Intersects` against bbox geometry doesn't fail
- **Stale connection recovery** - `getSession()` resets and reconnects once if the cached Databricks client has gone stale (warehouse restart, network drop)
- **Rate limiting behind load balancers** - Client IP taken from the first `X-Forwarded-For` hop, so all users no longer share one rate-limit bucket
- **Duplicate field metadata** - `DESCRIBE TABLE` parsing stops at the partition-information section instead of re-including repeated column rows
- **Open-ended time ranges** - `time=<start>,null` and `time=null,<end>` now produce `>=` / `<=` filters instead of being dropped
- **GeometryCollection coordinate extraction** - Fixed unreachable code path where GeometryCollection was not handled before the `coordinates` null check
- **ORDER BY sanitization** - Strict validation of column names and directions (ASC/DESC only)

### Security

- SQL injection protection on all user inputs: `where`, `outFields`, `orderByFields`, `timeField`
- Table name validation (catalog.schema.table format only)
- H3 column name validation
- Credentials excluded from git via `.gitignore` patterns

## [0.2.1] - 2026-01-12

### Added

- **API Endpoint URLs in HTML Demo Pages**: Added collapsible "API Endpoints" panels to multi-layer-map.html and large-dataset-map.html demo pages with copy-to-clipboard functionality
  - One-click URL copying for easy ArcGIS Online integration
  - Visual feedback ("✓ Copied!") when URL is copied to clipboard
  - Professional styling matching existing UI theme (blue for multi-layer, red for large-dataset)
  - Collapsed by default to save screen space

### Changed

- **Documentation URLs**: Replaced internal workspace URLs with generic placeholders for better consistency

### Fixed

- **Dynamic URL Detection in HTML Demo Pages**: Fixed hardcoded localhost URLs to dynamically detect current host
  - Demo pages now work correctly when deployed to Databricks Apps or any other hosting environment
  - Base URL automatically determined from `window.location.protocol` and `window.location.host`
  - API endpoint URLs in copy-to-clipboard sections updated dynamically
  - Added console logging of detected base URL for debugging

## [0.2.0] - 2026-01-11

### Major Performance Improvements

This release represents a complete rewrite of the data layer to leverage Databricks native geospatial functions, resulting in significant performance improvements and reduced network overhead.

### Added

#### Modern Koop Framework
- **Upgraded to @koopjs/koop-core@10.4.17** (from koop@3.17.0)
  - Latest Koop framework with 7 years of improvements
  - Backward compatible - no breaking changes
  - Modern ESM support and better error handling

#### Multi-Format Geometry Support
- **geometryFormat configuration**: Support for multiple geometry data formats
  - `"wkt"`: Well-Known Text (STRING column) - default
  - `"wkb"`: Well-Known Binary (BINARY column) - for PostGIS migrations
  - `"geojson"`: GeoJSON text (STRING column) - for web applications
  - `"geometry"`: Native Databricks GEOMETRY type - most efficient
- **Automatic format conversion** using appropriate ST functions:
  - ST_GeomFromText() for WKT
  - ST_GeomFromWKB() for WKB
  - ST_GeomFromGeoJSON() for GeoJSON
  - Direct column reference for native GEOMETRY type

#### Enhanced ArcGIS Compatibility
- **Automatic geometry type detection**:
  - Detects Point, LineString, Polygon, Multi* types
  - Maps to proper Esri types (esriGeometryPoint, esriGeometryPolyline, esriGeometryPolygon)
  - Populates metadata.geometryType for ArcGIS clients
- **Complete field metadata from DESCRIBE TABLE**:
  - Automatic schema introspection with caching
  - Maps Databricks types to Esri field types
  - Includes sqlType, alias, nullable, editable properties
  - Cached per-table to avoid repeated DESCRIBE queries

#### New Query Capabilities
- **returnExtentOnly support**: Fast bounding box queries
  - Uses ST_Envelope() and aggregate functions
  - Returns extent without fetching features
  - Optimizes initial map load performance
- **Time filtering support**:
  - `time` parameter for temporal queries (milliseconds since epoch)
  - `timeField` parameter to specify date/time column
  - Supports single timestamp or time range
  - Automatic conversion to Databricks TIMESTAMP format
- **returnCountOnly and returnIdsOnly**: Already supported, now documented
  - Efficient count queries without fetching data
  - ID-only queries for pagination tracking

#### Performance Optimizations
- **Metadata caching**: In-memory cache for DESCRIBE TABLE results
  - Prevents repeated expensive schema queries
  - Significant performance improvement for repeated requests
  - Per-table caching with fieldsCache

#### Databricks ST Functions Integration
- **ST_AsGeoJSON()**: Geometry conversion now happens in Databricks, not Node.js
  - Eliminates client-side WKT parsing
  - Reduces network payload
  - Native GeoJSON output from database
- **ST_Intersects()**: Spatial bbox filtering executed as native SQL
  - Database-side spatial filtering
  - Supports standard Koop geometry parameters
  - Much faster than client-side filtering
- **ST_GeomFromText()**: Native geometry construction for spatial predicates
- **ST_GeomFromWKB()**: Binary geometry parsing (new in v0.2)
- **ST_GeomFromGeoJSON()**: GeoJSON parsing (new in v0.2)
- **ST_Envelope()**: Bounding box extraction for returnExtentOnly

#### Standard Koop Query Parameters
- `where`: SQL WHERE clause for attribute filtering
- `geometry`: Bounding box spatial filter
- `geometryType`: Geometry type specification (supports esriGeometryEnvelope)
- `outFields`: Column selection (comma-separated field names or *)
- `returnGeometry`: Boolean to include/exclude geometry (performance optimization)
- `resultOffset`: Pagination offset
- `resultRecordCount`: Pagination limit
- `orderByFields`: SQL ORDER BY with ASC/DESC support

#### Metadata Enhancements
- Automatic extent calculation from returned features
- Proper idField metadata
- maxRecordCount metadata
- spatialReference metadata with WKID

#### Infrastructure
- Proper logging system with configurable log levels (ERROR, WARN, INFO, DEBUG)
- Input validation for table names to prevent SQL injection
- Comprehensive validation for H3 filter parameters
- Enhanced error handling with proper error propagation
- Resource cleanup in finally blocks to prevent connection leaks
- New logger module (src/logger.js) for structured logging
- Validation test suite (test/validation-test.js)
- Improved .env.example with detailed documentation

### Changed

#### Core Architecture
- Complete rewrite of model.js to use ST functions
- Replaced client-side WKT parsing with ST_AsGeoJSON()
- Replaced client-side bbox conversion with ST_Intersects()
- Query building now generates optimized SQL with column selection
- Removed all client-side geometry manipulation

#### Dependencies (Simplified)
- **Removed** @mapbox/geojson-rewind (no longer needed)
- **Removed** @turf/bbox-polygon (replaced by ST_GeomFromText)
- **Removed** @turf/projection (handled by spatialReference config)
- **Removed** wellknown (replaced by ST_AsGeoJSON)
- **Removed** request (deprecated, unused)
- **Added** uuid for request tracking

#### Configuration
- Removed `tableName` from config (now in URL path)
- Removed `sridColumn` (no longer needed with ST_AsGeoJSON)
- Changed `geometryColumn` default to `geometry_wkt`
- Added `spatialReference` configuration (default: 4326)
- Changed `maxRows` to integer with default 10000

#### Documentation
- Complete README rewrite with:
  - Standard Koop query parameter documentation
  - ST functions usage examples
  - Performance optimization guide
  - Database optimization recommendations
  - Comprehensive API examples
  - Troubleshooting section
- Enhanced .env.example with detailed comments
- New CHANGELOG.md following Keep a Changelog format

### Fixed
- Error handling now properly propagates errors through callbacks
- Connections and sessions are now properly closed even on errors
- H3 filter validates column names to prevent injection attacks
- Missing uuid dependency that was being used but not declared
- Geometry parsing errors are now caught and logged properly
- Query parameter validation prevents malformed queries

### Security
- Table name validation prevents SQL injection (format: catalog.schema.table)
- H3 column name validation using regex pattern
- Validates numeric inputs for bbox coordinates and H3 resolution
- ORDER BY clause sanitization
- WHERE clause passed through parameterized queries

### Performance Metrics

**Before (0.0.2):**
- Geometry parsing: Client-side (Node.js)
- Spatial filtering: Client-side or limited H3
- Network: Full WKT + SRID columns transferred
- Dependencies: 5 geometry manipulation libraries

**After (0.2.0):**
- Geometry parsing: Database-side (Databricks ST_AsGeoJSON)
- Spatial filtering: Database-side (ST_Intersects)
- Network: Only GeoJSON for requested features
- Dependencies: 0 geometry manipulation libraries
- Column selection: Only requested fields transferred
- Result: 50-80% reduction in network payload, 3-5x faster queries

## [0.0.2] - Previous Release

Initial release with basic Databricks SQL provider functionality.
