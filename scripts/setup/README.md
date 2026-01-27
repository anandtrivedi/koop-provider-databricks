# Setup Scripts

These scripts were used to create test data in Databricks Community Edition during initial setup.

## Available Scripts

### create-large-dataset.js
Creates 10,000 US cities with realistic geographic distribution.

**Usage:**
```bash
node create-large-dataset.js
```

**Creates:**
- `geospatial.large_us_cities` (10,000 rows)
- Attributes: city_name, state, population, area, income, elevation, geometry

**Layer URL:**
```
https://koop-databricks.onrender.com/databricks/rest/services/geospatial.large_us_cities/FeatureServer/0
```

---

### create-community-fixed.js
Creates small test tables (4 tables, 17 total features).

**Usage:**
```bash
node create-community-fixed.js
```

**Creates:**
- `geospatial.koop_test_cities` (10 cities)
- `geospatial.koop_test_highways` (2 highways)
- `geospatial.koop_test_states` (2 states)
- `geospatial.koop_test_parks` (3 parks)

**Layer URLs:**
```
https://koop-databricks.onrender.com/databricks/rest/services/geospatial.koop_test_cities/FeatureServer/0
https://koop-databricks.onrender.com/databricks/rest/services/geospatial.koop_test_highways/FeatureServer/0
https://koop-databricks.onrender.com/databricks/rest/services/geospatial.koop_test_states/FeatureServer/0
https://koop-databricks.onrender.com/databricks/rest/services/geospatial.koop_test_parks/FeatureServer/0
```

---

### verify-community-tables.js
Verifies that tables exist and contain data.

**Usage:**
```bash
node verify-community-tables.js
```

---

### test-community-tables.js
Tests different table naming formats and queries sample data.

**Usage:**
```bash
node test-community-tables.js
```

---

## Configuration

All scripts use the same Databricks Community Edition configuration:

```javascript
const config = {
  host: 'dbc-1e152a66-a886.cloud.databricks.com',
  path: '/sql/1.0/warehouses/b756bd164fba99fd',
  token: 'dapi_token_here' // Update with your token
};
```

**Note:** Update the `token` value in each script before running.

---

## Historical Scripts (Deprecated)

### create-azure-test-tables.js
**Deprecated:** Used for Azure Databricks workspace (had IP restrictions)

### create-community-test-tables.js
**Deprecated:** Original version, created tables in `default` schema instead of `geospatial`

### create-community-geospatial-tables.js
**Deprecated:** Superseded by `create-community-fixed.js`

---

## Data Schema

All geospatial tables follow this pattern:

```sql
CREATE TABLE geospatial.table_name (
  objectid INT,
  [attributes...],
  geometry_wkt STRING  -- WKT format: POINT, LINESTRING, or POLYGON
);
```

**Geometry Types:**
- **POINT:** `POINT(lon lat)` - e.g., `POINT(-74.006 40.7128)`
- **LINESTRING:** `LINESTRING(lon1 lat1, lon2 lat2, ...)` - multi-point line
- **POLYGON:** `POLYGON((lon1 lat1, lon2 lat2, ..., lon1 lat1))` - closed ring

---

## Troubleshooting

### Error: "Schema not found"
Create the schema first:
```sql
CREATE SCHEMA IF NOT EXISTS geospatial;
```

### Error: "Authentication failed"
Update the `token` value in the script with a valid Databricks PAT token.

### Error: "Warehouse not found"
Verify the warehouse is running:
```sql
-- Check available warehouses
SHOW WAREHOUSES;
```

---

## Next Steps

After creating test data:

1. **Verify Render deployment is using Community Edition:**
   - DATABRICKS_SERVER_HOSTNAME = `dbc-1e152a66-a886.cloud.databricks.com`
   - DATABRICKS_HTTP_PATH = `/sql/1.0/warehouses/b756bd164fba99fd`
   - DATABRICKS_TOKEN = Your Community Edition PAT token

2. **Test the endpoint:**
   ```bash
   curl "https://koop-databricks.onrender.com/databricks/rest/services/geospatial.large_us_cities/FeatureServer/0?f=json"
   ```

3. **Add to ArcGIS Online:**
   - Go to https://www.arcgis.com
   - Map Viewer → Add → Add Layer from URL
   - Paste layer URL

---

## Security Note

These scripts contain placeholder tokens. **Never commit real tokens to git!**

Update `.gitignore` to exclude sensitive files:
```
*.env
**/auth.json
config/auth.json
```
