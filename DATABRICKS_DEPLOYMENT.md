# Deploying Koop Provider to Databricks

This guide explains how to deploy the Koop Databricks provider to Databricks for production use with ArcGIS Online.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Overview](#architecture-overview)
3. [Option 1: Databricks Apps (Recommended)](#option-1-databricks-apps-recommended)
4. [Option 2: Model Serving](#option-2-model-serving)
5. [Testing the Deployment](#testing-the-deployment)
6. [Connecting to ArcGIS Online](#connecting-to-arcgis-online)

---

## Overview

**Why deploy to Databricks?**

- ✅ **Native integration** - Direct access to Databricks SQL Warehouses without networking config
- ✅ **Secure** - Uses internal authentication, no need to expose credentials
- ✅ **Scalable** - Auto-scales with your SQL Warehouse
- ✅ **Production URL** - Gets a proper `*.cloud.databricks.com` domain that ArcGIS Online accepts
- ✅ **Cost-effective** - No separate infrastructure needed

**Deployment Options:**

| Option | Difficulty | Best For | URL Format |
|--------|-----------|----------|------------|
| Databricks Apps | Easy | Quick deployment, development | `https://<workspace>.cloud.databricks.com/apps/<app-id>` |
| Model Serving | Medium | Production, custom domains | `https://<workspace>.cloud.databricks.com/serving-endpoints/<name>` |

---

## Architecture Overview

This deployment creates a complete end-to-end geospatial data pipeline on Databricks:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Databricks Platform                           │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              Deployed Koop Server (Container/App)              │ │
│  │                                                                  │ │
│  │  ┌──────────────┐        ┌─────────────────────────────────┐  │ │
│  │  │              │        │   Koop Databricks Provider       │  │ │
│  │  │   Express    │──────▶│   - Model (SQL queries)          │  │ │
│  │  │   Server     │        │   - Controller (API endpoints)   │  │ │
│  │  │   (Node.js)  │        │   - WKT to GeoJSON conversion    │  │ │
│  │  │              │        │   - Pagination & filtering       │  │ │
│  │  └──────────────┘        └────────────┬────────────────────┘  │ │
│  │                                        │                        │ │
│  │                                        │ SQL Queries            │ │
│  │                                        ▼                        │ │
│  │                            ┌──────────────────────┐           │ │
│  │                            │  SQL Warehouse       │           │ │
│  │                            │  (Serverless)        │           │ │
│  │                            └──────────┬───────────┘           │ │
│  │                                        │                        │ │
│  │                                        │ Reads from             │ │
│  │                                        ▼                        │ │
│  │                            ┌──────────────────────┐           │ │
│  │                            │  Delta Tables        │           │ │
│  │                            │  (with WKT geometry) │           │ │
│  │                            └──────────────────────┘           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Public URL: https://your-workspace.databricksapps.com/...          │
└───────────────────────────────────────────────────────────────────────┘
                               │
                               │ ArcGIS FeatureServer REST API
                               ▼
                    ┌──────────────────────────┐
                    │  Client Applications     │
                    │  - ArcGIS Pro            │
                    │  - ArcGIS Online         │
                    │  - ESRI JavaScript API   │
                    │  - Custom web apps       │
                    └──────────────────────────┘
```

### Key Components

1. **Koop Server**: Translates between Databricks tables and ArcGIS FeatureServer API
2. **Databricks Provider**: Custom plugin that queries SQL Warehouse and converts WKT geometries to GeoJSON
3. **SQL Warehouse**: Serverless compute that reads from Delta tables
4. **Delta Tables**: Your geospatial data with WKT geometry columns

### Data Flow

1. Client requests features via FeatureServer API endpoint
2. Koop provider generates SQL query with filters/pagination
3. SQL Warehouse executes query on Delta tables
4. Provider converts WKT geometries to GeoJSON
5. Response formatted as ArcGIS FeatureServer JSON
6. Client applications visualize data using ArcGIS tools

---

## Option 1: Databricks Apps (Recommended)

Databricks Apps is the easiest way to deploy web applications directly from your workspace.

### Prerequisites

- Databricks workspace with Apps enabled
- Unity Catalog access
- SQL Warehouse running

### Step 1: Prepare the Application

Create a `databricks-app.yml` configuration file:

```bash
cat > databricks-app.yml <<'EOF'
# Databricks App Configuration
name: koop-databricks-provider
description: Koop provider for serving Databricks tables as ArcGIS FeatureServer

# Command to start the app
command: ["npm", "start"]

# Environment variables
env:
  NODE_ENV: production
  LOG_LEVEL: INFO
  PORT: 8080

# Resource requirements
resources:
  memory: 2Gi
  cpu: 1

# Health check
health_check:
  path: /databricks/rest/info
  port: 8080
  initial_delay_seconds: 30
  period_seconds: 10

# Port to expose
ports:
  - 8080
EOF
```

### Step 2: Create Dockerfile for Databricks Apps

Databricks Apps supports containerized applications. Create a Dockerfile:

```bash
cat > Dockerfile <<'EOF'
FROM node:18-alpine

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
EOF
```

### Step 3: Create .dockerignore

```bash
cat > .dockerignore <<'EOF'
node_modules
.git
.env
*.log
test-*.js
test-*.sh
*.md
.github
.dockerignore
Dockerfile
EOF
```

### Step 4: Deploy via Databricks CLI

```bash
# Install Databricks CLI (if not already installed)
pip install databricks-cli

# Configure authentication
databricks configure --token

# Create the app
databricks apps create koop-databricks-provider \
  --source-code-path . \
  --config databricks-app.yml

# Get the app URL
databricks apps get koop-databricks-provider
```

### Step 5: Configure Environment Variables in Databricks

In the Databricks Apps UI:

1. Go to your workspace → Apps → koop-databricks-provider
2. Click "Configuration"
3. Add environment variables:
   - `DATABRICKS_SERVER_HOSTNAME`: (automatically provided by Databricks)
   - `DATABRICKS_HTTP_PATH`: `/sql/1.0/warehouses/<warehouse-id>`
   - `DATABRICKS_TOKEN`: (use Databricks secret scope)

### Using Databricks Secrets

```bash
# Create secret scope
databricks secrets create-scope --scope koop-provider

# Add SQL Warehouse token
databricks secrets put --scope koop-provider --key databricks-token

# Reference in app config
# env:
#   DATABRICKS_TOKEN: "{{secrets/koop-provider/databricks-token}}"
```

### Step 6: Access Your App

Your app will be available at:
```
https://<workspace-id>.cloud.databricks.com/apps/<app-id>
```

Example:
```
https://e2-demo-field-eng.cloud.databricks.com/apps/koop-provider
```

**Full FeatureServer URL:**
```
https://<workspace-id>.cloud.databricks.com/apps/<app-id>/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0
```

---

## Option 2: Model Serving

For more control and production use, deploy as a Model Serving endpoint.

### Step 1: Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app
COPY . .

# Expose port (Model Serving uses 8080)
EXPOSE 8080

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/databricks/rest/info', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
```

### Step 2: Build and Push Docker Image

```bash
# Login to Databricks Container Registry
databricks auth login

# Build image
docker build -t koop-databricks-provider:latest .

# Tag for Databricks
docker tag koop-databricks-provider:latest \
  <workspace-url>/koop-databricks-provider:latest

# Push to Databricks
docker push <workspace-url>/koop-databricks-provider:latest
```

### Step 3: Create Model Serving Endpoint

Via Databricks CLI:

```bash
databricks serving-endpoints create \
  --name koop-provider \
  --config '{
    "served_models": [{
      "model_name": "koop-databricks-provider",
      "model_version": "1",
      "workload_size": "Small",
      "scale_to_zero_enabled": false
    }]
  }'
```

Via UI:

1. Go to Serving → Create Serving Endpoint
2. Name: `koop-provider`
3. Model: Upload your Docker container
4. Workload size: Small (for development) or Medium (for production)
5. **Disable scale-to-zero** for consistent performance

### Step 4: Get Serving Endpoint URL

```bash
databricks serving-endpoints get koop-provider
```

Your endpoint will be:
```
https://<workspace-id>.cloud.databricks.com/serving-endpoints/koop-provider
```

---

## Testing the Deployment

### 1. Test Service Info

```bash
curl "https://<your-databricks-url>/databricks/rest/info"
```

Expected response:
```json
{
  "currentVersion": 10.51,
  "fullVersion": "10.5.1",
  ...
}
```

### 2. Test Layer Metadata

```bash
curl "https://<your-databricks-url>/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0?f=json"
```

### 3. Test Query

```bash
curl "https://<your-databricks-url>/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?where=1=1&resultRecordCount=5&f=json"
```

### 4. Run Comprehensive Tests

Update `test-comprehensive.sh` with your deployment URL:

```bash
BASE_URL="https://<your-databricks-url>/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query"

bash test-comprehensive.sh
```

---

## Connecting to ArcGIS Online

Once deployed to Databricks, you can add your FeatureServer to ArcGIS Online.

### Steps:

1. **Get Your FeatureServer URL:**
   ```
   https://<workspace-id>.cloud.databricks.com/apps/<app-id>/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0
   ```

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

### Example URLs:

For a table `main.geospatial.us_cities`:

**Service-level URL:**
```
https://e2-demo-field-eng.cloud.databricks.com/apps/koop-provider/databricks/rest/services/main.geospatial.us_cities/FeatureServer
```

**Layer URL:**
```
https://e2-demo-field-eng.cloud.databricks.com/apps/koop-provider/databricks/rest/services/main.geospatial.us_cities/FeatureServer/0
```

---

## Environment Variables

Configure these environment variables in your Databricks deployment:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABRICKS_SERVER_HOSTNAME` | Workspace hostname | `e2-demo-field-eng.cloud.databricks.com` |
| `DATABRICKS_HTTP_PATH` | SQL Warehouse path | `/sql/1.0/warehouses/428aad03ef2b6b5f` |
| `DATABRICKS_TOKEN` | Authentication token | Use Databricks secrets |
| `LOG_LEVEL` | Logging level | `INFO` or `DEBUG` |
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Server port | `8080` |

**Note:** When running on Databricks, you can use Unity Catalog authentication instead of tokens. The provider will automatically use the workspace's identity.

---

## Authentication Options

### Option 1: Service Principal (Recommended for Production)

```bash
# Create service principal
databricks service-principals create --display-name "Koop Provider"

# Grant permissions
databricks grants create \
  --principal "koop-provider-sp" \
  --privileges SELECT \
  --table main.geospatial.us_cities
```

Environment variables:
```
DATABRICKS_CLIENT_ID=<service-principal-id>
DATABRICKS_CLIENT_SECRET=<secret>
```

### Option 2: Personal Access Token

Use Databricks secrets to store the token securely.

### Option 3: Workload Identity (Databricks Apps)

When running as a Databricks App, the application automatically inherits the workspace's identity. No credentials needed!

---

## Scaling Considerations

### SQL Warehouse Sizing

The Koop provider performance depends on your SQL Warehouse:

| Workload | Warehouse Size | Expected Latency |
|----------|---------------|------------------|
| Development/Testing | X-Small | 1-3 seconds |
| Light Production | Small | 500ms - 1s |
| Production | Medium | 200-500ms |
| Heavy Production | Large | < 200ms |

### App Scaling

**Databricks Apps:**
- Auto-scales based on load
- Configure min/max instances in `databricks-app.yml`

**Model Serving:**
- Configure workload size (Small/Medium/Large)
- Enable auto-scaling for variable load
- Disable scale-to-zero for consistent performance

### Caching

Consider adding Redis or caching layer for:
- Layer metadata (rarely changes)
- Count queries
- Frequently accessed spatial extents

---

## Monitoring

### Databricks Monitoring

1. **Apps Dashboard:**
   - Go to Workspace → Apps → Your App
   - View logs, metrics, and health status

2. **Model Serving Metrics:**
   - Request rate
   - Latency (p50, p95, p99)
   - Error rate

3. **SQL Warehouse Metrics:**
   - Query duration
   - Queue time
   - Cache hit rate

### Application Logs

Access logs via Databricks UI or CLI:

```bash
# View recent logs
databricks apps logs koop-databricks-provider --tail 100

# Stream logs
databricks apps logs koop-databricks-provider --follow
```

### Custom Monitoring

The provider logs all requests with:
- Request ID
- Query SQL
- Row count
- Processing time

Example log:
```
[2026-01-11T23:00:16.083Z] [INFO] e2c11aec> Received request: .../query?returnCountOnly=true
[2026-01-11T23:00:16.479Z] [INFO] e2c11aec> Received 10 rows
```

---

## Troubleshooting

### Issue: App won't start

**Check:**
1. Dockerfile builds locally: `docker build -t test .`
2. Port 8080 is exposed
3. Health check endpoint responds
4. Environment variables are set

**Logs:**
```bash
databricks apps logs koop-databricks-provider --tail 200
```

### Issue: SQL queries failing

**Check:**
1. SQL Warehouse is running
2. Permissions granted to service principal
3. Table exists: `SELECT * FROM main.default.koop_test_cities LIMIT 1`
4. Geometry column is WKT string format

### Issue: ArcGIS Online connection fails

**Check:**
1. URL is accessible from public internet
2. Service returns valid JSON: `curl <url>/FeatureServer/0?f=json`
3. CORS headers present: `access-control-allow-origin: *`
4. No authentication required (or token in URL)

### Issue: Slow performance

**Check:**
1. SQL Warehouse size appropriate for load
2. Table has indexes on `objectid` column
3. Use pagination (`resultRecordCount`) for large datasets
4. Consider spatial indexing for geometry_wkt

---

## Security Best Practices

1. **Use Service Principal** instead of personal access tokens
2. **Store secrets** in Databricks Secret Scopes
3. **Grant minimum permissions** (SELECT only on needed tables)
4. **Enable audit logging** in Databricks workspace
5. **Use Unity Catalog** for fine-grained access control
6. **Enable HTTPS** (automatic with Databricks URLs)
7. **Rate limiting** - Consider adding rate limits for public endpoints

---

## Cost Optimization

1. **Right-size SQL Warehouse:**
   - Start with X-Small for testing
   - Scale up based on actual usage

2. **Enable Serverless SQL:**
   - Faster startup
   - Pay only for query time

3. **Use caching:**
   - Cache layer metadata
   - Cache count queries
   - Set appropriate TTLs

4. **Optimize queries:**
   - Use `outFields` to select only needed columns
   - Use `resultRecordCount` to limit page size
   - Encourage use of `returnCountOnly` and `returnIdsOnly`

---

## Next Steps

1. **Deploy to development environment** using Databricks Apps
2. **Test with ArcGIS Online** using the Databricks URL
3. **Set up monitoring** and alerts
4. **Create service principal** for production
5. **Document your tables** and endpoints for users
6. **Scale SQL Warehouse** based on load testing
7. **Consider multi-region** deployment for global users

---

## Additional Resources

- [Databricks Apps Documentation](https://docs.databricks.com/en/apps/index.html)
- [Model Serving Guide](https://docs.databricks.com/en/machine-learning/model-serving/index.html)
- [Unity Catalog Permissions](https://docs.databricks.com/en/data-governance/unity-catalog/manage-privileges/index.html)
- [ArcGIS Server REST API](https://developers.arcgis.com/rest/services-reference/enterprise/feature-service.htm)
- [Koop Documentation](https://koopjs.github.io/)

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
