# Examples

This folder contains optional examples and testing utilities for the Koop Databricks Provider.

## ⚠️ Important Note

**These examples are NOT required to use the Koop Databricks Provider.**

The provider is a library/plugin that users install and integrate into their own applications. These examples are provided for reference and testing purposes only.

## Folder Structure

### `/databricks-app` - Deployment Example

A minimal standalone app showing how to deploy the provider to Databricks Apps or Model Serving.

**When to use this:**
- You want to quickly test on Databricks without writing your own app
- You need a reference implementation for deployment
- You want a starting point that you can customize

**When NOT to use this:**
- For normal usage - integrate the provider into your own application instead
- See the main README for standard integration examples

### `/testing` - Test Scripts and Utilities

Testing utilities and example scripts for development and validation.

**Contents:**
- `test-connection.js` - Test Databricks SQL Warehouse connection
- `create-test-table.js` - Create sample geospatial table
- `test-comprehensive.sh` - Run full FeatureServer API tests
- `test-performance.js` - Performance benchmarking
- `test-arcgis-map.html` - Interactive map test with ArcGIS JS API
- Database utility scripts for creating test datasets

**Usage:**
```bash
cd examples/testing
node test-connection.js
bash test-comprehensive.sh
```

## Normal Usage (Without These Examples)

Most users should integrate the provider directly:

### 1. Install the Provider

```bash
npm install @databricks/koop-provider
```

### 2. Use in Your App

```javascript
const Koop = require('@koopjs/koop-core')
const databricksProvider = require('@databricks/koop-provider')

const koop = new Koop()
koop.register(databricksProvider)
koop.server.listen(8080)
```

### 3. Configure Environment

```bash
export DATABRICKS_SERVER_HOSTNAME="your-workspace.cloud.databricks.com"
export DATABRICKS_HTTP_PATH="/sql/1.0/warehouses/your-warehouse-id"
export DATABRICKS_TOKEN="your-token"
```

### 4. Access FeatureServer

```
http://localhost:8080/databricks/rest/services/{catalog}.{schema}.{table}/FeatureServer/0
```

## Moving Examples to Separate Repository

These examples can easily be extracted to a separate repository:

```bash
# Copy the databricks-app example
cp -r examples/databricks-app ../koop-databricks-deployment

# Initialize new repo
cd ../koop-databricks-deployment
git init
git add .
git commit -m "Initial commit"

# Update package.json to use published provider
# Change: "@databricks/koop-provider": "file:../.."
# To: "@databricks/koop-provider": "^0.2.0"
```

## Documentation

- Main README: `../README.md`
- Deployment Guide: `../DATABRICKS_DEPLOYMENT.md`
- ArcGIS Testing: `../ARCGIS_TESTING.md`
- Improvements Summary: `../V0.2_IMPROVEMENTS_SUMMARY.md`

## Support

For questions about the provider itself, see the main repository documentation.

For deployment-specific questions, see the deployment example README:
- `databricks-app/README.md`
