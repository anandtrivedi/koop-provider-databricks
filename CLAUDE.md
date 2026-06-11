# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

[Koop](https://koopjs.github.io/) is an open-source Node.js server that acts as a geospatial ETL engine. Its plugin architecture has two sides: **providers** fetch data from remote sources and convert it to GeoJSON, and **outputs** (the built-in default is ArcGIS FeatureServer) serve that GeoJSON to clients in the format they expect. Existing providers cover sources like AWS S3, PostgreSQL/PostGIS, Google Sheets, and Socrata — once data is GeoJSON inside Koop, it can be queried, cached, and served uniformly regardless of origin.

This repository is the **Databricks provider for Koop** — a read-only bridge between Databricks SQL (DBSQL) and the ArcGIS ecosystem. Any ArcGIS client (ArcGIS Online, ArcGIS Pro, ArcGIS Enterprise, ArcGIS Maps SDK JS apps) can consume Databricks tables as standard ArcGIS FeatureServer layers. The provider translates ArcGIS REST API query parameters into Databricks SQL — using Databricks-side `ST_` spatial functions for geometry operations — and returns GeoJSON that Koop's FeatureServer output serves back to the client.

## Commands

```bash
npm test                                          # StandardJS lint + all Tape tests
npm start                                         # Start Koop server (needs .env)
npx tape test/query-builder-test.js | npx tap-spec  # Run a single test file
```

No build step — plain JavaScript, no TypeScript, no transpilation.

## Architecture

### Request flow

```
ArcGIS Client
  → GET /databricks/rest/services/{catalog.schema.table}/FeatureServer/0/query?where=...&geometry=...
  → Koop FeatureServer router
  → Model.getData(req, callback)
    → validates table name, checks rate limit
    → dispatches to query builder (buildQuery / buildCountQuery / buildIdsQuery / buildExtentQuery)
    → connectionManager.getSession() → executes SQL against Databricks warehouse
    → translateWithSTFunctions() converts rows to GeoJSON FeatureCollection
    → attaches metadata (idField, geometryType, field definitions from DESCRIBE TABLE)
    → sets filtersApplied flags so Koop doesn't re-filter
  → callback(null, geojson) → Koop serializes as ArcGIS FeatureServer JSON response
```

### Source files (`src/`)

**`model.js`** (~815 lines) — the core of the provider. Contains:
- `getData()` — the single entry point Koop calls. Validates input, rate-limits by IP, dispatches to the right query builder based on `returnCountOnly` / `returnIdsOnly` / `returnExtentOnly`, executes SQL, converts results to GeoJSON, attaches metadata.
- Query builders: `buildQuery()`, `buildCountQuery()`, `buildIdsQuery()`, `buildExtentQuery()` — each assembles a SQL string with validated WHERE, bbox filter (`ST_Intersects`), time filter, H3 filter, ORDER BY, LIMIT/OFFSET.
- `buildSelectClause()` — appends `ST_AsGeoJSON(buildGeometryExpression()) as __geojson__` to the SELECT when geometry is requested. The `__geojson__` column is parsed client-side and stripped from properties.
- `buildGeometryExpression()` — returns the right `ST_GeomFrom*` call for the configured format (`wkt`→`ST_GeomFromText`, `wkb`→`ST_GeomFromWKB`, `geojson`→`ST_GeomFromGeoJSON`, `geometry`→bare column).
- `translateWithSTFunctions()` — maps result rows to GeoJSON Features, parsing `__geojson__` into geometry.
- `calculateExtent()` / `getAllCoordinates()` — client-side bounding box computation from returned features. `getAllCoordinates` recursively handles all GeoJSON geometry types including `GeometryCollection` (which has `geometries` instead of `coordinates`).
- `mapDatabricksToEsriFieldType()` — maps Databricks column types (from DESCRIBE TABLE) to Esri field types.
- `getFieldMetadata()` — runs `DESCRIBE {table}`, caches results per-table with TTL (default 5min) and LRU eviction (max 100 entries).
- `checkRateLimit()` — sliding-window rate limiter keyed by IP.
- All internal functions are exported via `Model._internals` for unit testing.

**`connection.js`** — singleton `ConnectionManager` class. Lazily creates one `DBSQLClient`, reuses it across requests. Each request gets its own session via `getSession()` → `client.openSession()`. Auto-detects auth from env vars: Service Principal OAuth (`DATABRICKS_CLIENT_ID` + `DATABRICKS_CLIENT_SECRET`) takes precedence over PAT (`DATABRICKS_TOKEN`). Sets user agent `esri_databricks-koop-provider/{version}` for Databricks partner telemetry. Registers `SIGTERM`/`SIGINT` cleanup handlers.

**`validation.js`** — SQL injection prevention. `validateWhereClause()` checks against a dangerous-keyword blocklist (DROP, CREATE, ALTER, TRUNCATE, INSERT, UPDATE, DELETE, UNION, EXEC, GRANT, REVOKE), then parses via `js-sql-parser` to reject unparseable SQL and nested subqueries. `validateColumnName()` enforces `^[a-zA-Z_][a-zA-Z0-9_]*$`. `validateColumnList()` splits on commas and validates each field.

**`index.js`** — Koop provider registration object: `{ type: 'provider', name: 'databricks', Model, Controller, routes, version }`. Loads `dotenv`.

**`logger.js`** — singleton leveled logger (ERROR/WARN/INFO/DEBUG), configured via `LOG_LEVEL` env var.

**`controller.js` / `routes.js`** — empty stubs. Koop's default FeatureServer controller handles all routing.

### How Koop uses this provider

Koop auto-registers this provider under the name `databricks`. The URL path is `/:name/:id/FeatureServer/:layer/:method` where `:id` is the table name (e.g., `catalog.schema.table`), `:layer` is always `0`, and `:method` is typically `query`. Koop's built-in FeatureServer output handles serialization of the GeoJSON into ArcGIS-compatible JSON responses.

The `filtersApplied` object (`{ offset: true, limit: true, where: true, geometry: true }`) tells Koop that all filtering was done server-side in SQL, preventing Koop from re-applying these filters on the GeoJSON.

## Tests

Three test files in `test/`, all using **Tape** with **tap-spec** formatter:

- **`query-builder-test.js`** (~530 lines) — unit tests for every internal function via `Model._internals`. Covers table name validation, ORDER BY sanitization, SELECT clause generation, all four query builders, bbox/time filters, GeoJSON translation, coordinate extraction from all geometry types, Databricks-to-Esri type mapping, and rate limiting.
- **`validation-test.js`** (~290 lines) — module loading, WHERE clause acceptance (9 valid ArcGIS patterns) and rejection (11 SQL injection vectors), column name/list validation, model-level integration tests (invalid table, missing credentials), cache TTL behavior.
- **`model-test.js`** (~44 lines) — live integration test against a real Databricks table. Skips gracefully when `DATABRICKS_SERVER_HOSTNAME` is not set.

## Code Style

**StandardJS** (v14) — no semicolons, 2-space indent, single quotes. Enforced as the first step of `npm test`. The `examples/` directory is excluded from linting (configured in `package.json` under `"standard": { "ignore": ["examples/"] }`).

## Configuration

Five provider settings in `config/default.json`, all overridable via env vars:

| Setting | Config key | Env var | Default |
|---------|-----------|---------|---------|
| Object ID column | `objectId` | `OBJECT_ID_COLUMN` | `objectid` |
| Geometry column | `geometryColumn` | `GEOMETRY_COLUMN` | `geometry_wkt` |
| Geometry format | `geometryFormat` | `GEOMETRY_FORMAT` | `wkt` |
| Spatial reference | `spatialReference` | `SPATIAL_REFERENCE` | `4326` |
| Max rows per query | `maxRows` | `MAX_ROWS` | `10000` |

Additional env-only settings: `QUERY_TIMEOUT_SECONDS` (30), `CACHE_TTL_MS` (300000), `RATE_LIMIT_MAX` (100), `RATE_LIMIT_WINDOW_MS` (60000), `LOG_LEVEL` (INFO).

Required env vars: `DATABRICKS_SERVER_HOSTNAME`, `DATABRICKS_HTTP_PATH`, and either `DATABRICKS_TOKEN` (PAT) or `DATABRICKS_CLIENT_ID` + `DATABRICKS_CLIENT_SECRET` (Service Principal OAuth).

## Key Conventions

- Table names must be 2- or 3-part dotted identifiers (`catalog.schema.table` or `schema.table`), validated by regex in `isValidTableName()`.
- Source tables must have an integer `objectid` column (unique, non-null) — this is required by the ArcGIS FeatureServer contract.
- `@koopjs/cli` is a **production** dependency — it provides the `koop serve` command at runtime.
- The `js-sql-parser` package used in `validation.js` comes transitively from `@koopjs/winnow` (a Koop dependency), not as a direct dependency.
- All geometry conversion happens Databricks-side via `ST_AsGeoJSON()`. The only client-side geometry work is parsing the resulting JSON string and computing extent bounding boxes.
- The connection is a singleton (one `DBSQLClient` shared across all requests); sessions are per-request and cleaned up in `finally` blocks.
