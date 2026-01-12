# Deploying Koop Provider

This guide explains how to deploy the Koop Databricks provider for use with ArcGIS Online and other ArcGIS clients.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Overview](#architecture-overview)
3. [Option 1: Databricks Apps (Easiest)](#option-1-databricks-apps-easiest)
4. [Option 2: Standalone Koop Server (Most Flexible)](#option-2-standalone-koop-server-most-flexible)
5. [Option 3: Databricks Model Serving (Advanced)](#option-3-databricks-model-serving-advanced)
6. [Testing the Deployment](#testing-the-deployment)
7. [Connecting to ArcGIS Online](#connecting-to-arcgis-online)

---

## Overview

The Koop Databricks Provider can be deployed in multiple ways depending on your needs:

**Deployment Options:**

| Option | Difficulty | Best For | URL Format |
|--------|-----------|----------|------------|
| **Databricks Apps** | Easy | Fastest path to public URL, testing, demos | `https://<workspace>.databricksapps.com/...` |
| **Standalone Server** | Medium | Maximum flexibility, any cloud provider, existing infrastructure | `https://your-domain.com/...` |
| **Model Serving** | Advanced | Special Databricks integration requirements | `https://<workspace>.cloud.databricks.com/serving-endpoints/...` |

**Why use Databricks Apps or Model Serving?**

- ✅ **Native integration** - Direct access to Databricks SQL Warehouses without networking config
- ✅ **Secure** - Uses internal authentication, no need to expose credentials
- ✅ **Scalable** - Auto-scales with your SQL Warehouse
- ✅ **Managed** - HTTPS, domains, and hosting handled for you

**Why use Standalone?**

- ✅ **Maximum flexibility** - Deploy anywhere (AWS, Azure, GCP, on-prem)
- ✅ **Full control** - Customize networking, authentication, scaling
- ✅ **Integration** - Add to existing infrastructure and workflows
- ✅ **Standard Node.js** - Use any Node.js hosting environment

---

## Architecture Overview

### When Deployed on Databricks (Apps or Model Serving)

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

### When Deployed Standalone

```
┌─────────────────────────────────────┐        ┌────────────────────────┐
│   Your Infrastructure (AWS/Azure/GCP│        │  Databricks Platform   │
│                                      │        │                        │
│  ┌────────────────────────────────┐ │        │  ┌──────────────────┐ │
│  │   Koop Server (Node.js)        │ │        │  │  SQL Warehouse   │ │
│  │   - Express Server             │ │────────┼─▶│  (Serverless)    │ │
│  │   - Koop Provider              │ │  HTTPS │  └────────┬─────────┘ │
│  │   - WKT→GeoJSON conversion     │ │        │           │           │
│  └────────────────────────────────┘ │        │           │           │
│                                      │        │           ▼           │
│  Public URL: https://your-domain.com│        │  ┌──────────────────┐ │
└──────────────────────────────────────┘        │  │  Delta Tables    │ │
               │                                 │  │  (WKT geometry)  │ │
               │ ArcGIS FeatureServer API        │  └──────────────────┘ │
               ▼                                 └────────────────────────┘
    ┌──────────────────────┐
    │  ArcGIS Clients      │
    │  - Pro, Online, etc  │
    └──────────────────────┘
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

## Option 1: Databricks Apps (Easiest)

**Best for:** Quick deployment, testing, demos, getting a public URL fast

Databricks Apps is the easiest way to deploy - you get a public HTTPS URL with zero configuration.

### Prerequisites

- Databricks workspace with Apps enabled
- Unity Catalog access
- SQL Warehouse running

### Step 1: Prepare the Application

The example application in `examples/databricks-app/` is ready to deploy. It includes:
- `app.yaml` - Databricks Apps configuration
- `Dockerfile` - Container definition
- `server.js` - Koop server setup
- `package.json` - Dependencies

### Step 2: Deploy via Databricks CLI

```bash
# Install Databricks CLI (if not already installed)
pip install databricks-cli

# Configure authentication
databricks configure --token

# Deploy the app
cd examples/databricks-app
databricks apps create koop-databricks-provider \
  --source-code-path .

# Get the app URL
databricks apps get koop-databricks-provider
```

### Step 3: Configure Environment Variables

In the Databricks Apps UI:

1. Go to your workspace → Apps → koop-databricks-provider
2. Click "Configuration"
3. Add environment variables:
   - `DATABRICKS_HTTP_PATH`: `/sql/1.0/warehouses/<warehouse-id>`
   - `DATABRICKS_TOKEN`: (use Databricks secret scope)

### Your Public URL

Your app will be available at:
```
https://<workspace-id>.databricksapps.com/<app-id>/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0
```

Example:
```
https://e2-demo-field-eng.databricksapps.com/koop-provider/databricks/rest/services/main.default.cities/FeatureServer/0
```

**Done!** You now have a publicly accessible FeatureServer that works with ArcGIS Online.

---

## Option 2: Standalone Koop Server (Most Flexible)

**Best for:** Maximum control, existing infrastructure, any cloud provider, production deployments

Deploy Koop as a standalone Node.js application on any infrastructure.

### Prerequisites

- Node.js 18+ installed
- Access to Databricks SQL Warehouse (via HTTPS)
- Public IP or domain name
- SSL/TLS certificate (Let's Encrypt, etc.)

### Step 1: Install the Provider

```bash
# Create your project
mkdir my-koop-server
cd my-koop-server
npm init -y

# Install dependencies
npm install @koopjs/koop-core
npm install @databricks/koop-provider-databricks
```

### Step 2: Create Server File

```javascript
// server.js
const Koop = require('@koopjs/koop-core')
const databricksProvider = require('@databricks/koop-provider-databricks')

const koop = new Koop()

// Register the Databricks provider
koop.register(databricksProvider)

// Start the server
const port = process.env.PORT || 8080
koop.server.listen(port, () => {
  console.log(`Koop server listening on port ${port}`)
})
```

### Step 3: Configure Environment Variables

```bash
# .env file
DATABRICKS_SERVER_HOSTNAME=your-workspace.cloud.databricks.com
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/your-warehouse-id
DATABRICKS_TOKEN=your-token
PORT=8080
```

### Step 4: Deploy to Your Infrastructure

**Option A: AWS (EC2, ECS, Lambda)**
```bash
# Deploy to EC2
scp -r . ec2-user@your-server:/home/ec2-user/koop-server
ssh ec2-user@your-server
cd koop-server
npm install --production
npm start
```

**Option B: Azure (App Service, Container Instances)**
```bash
# Deploy to Azure App Service
az webapp up --name koop-databricks --resource-group myResourceGroup
```

**Option C: GCP (Compute Engine, Cloud Run)**
```bash
# Deploy to Cloud Run
gcloud run deploy koop-databricks --source .
```

**Option D: Docker**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

### Step 5: Configure HTTPS

Use nginx or a reverse proxy:

```nginx
server {
    listen 443 ssl;
    server_name koop.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Your Public URL

```
https://koop.your-domain.com/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0
```

---

## Option 3: Databricks Model Serving (Advanced)

**Best for:** Advanced users with specific Databricks Model Serving requirements

**Note:** For most users, **Databricks Apps (Option 1)** is simpler and recommended. Use Model Serving only if you have specific requirements that Apps doesn't meet.

### When to Use Model Serving

- You need custom endpoint configuration
- You're already using Model Serving for other workloads
- You have specific networking requirements within Databricks

### Step 1: Create Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "require('http').get('http://localhost:8080/databricks/rest/info', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["npm", "start"]
```

### Step 2: Build and Push Docker Image

```bash
# Build image
docker build -t koop-databricks-provider:latest .

# Tag for Databricks
docker tag koop-databricks-provider:latest \
  <workspace-url>/koop-databricks-provider:latest

# Push to Databricks
docker push <workspace-url>/koop-databricks-provider:latest
```

### Step 3: Create Model Serving Endpoint

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

Your endpoint will be:
```
https://<workspace-id>.cloud.databricks.com/serving-endpoints/koop-provider
```

---

## Testing the Deployment

### 1. Test Service Info

```bash
curl "https://<your-url>/databricks/rest/info"
```

Expected response:
```json
{
  "currentVersion": 10.51,
  "fullVersion": "10.5.1"
}
```

### 2. Test Layer Metadata

```bash
curl "https://<your-url>/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0?f=json"
```

### 3. Test Query

```bash
curl "https://<your-url>/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?where=1=1&resultRecordCount=5&f=json"
```

See [ARCGIS_TESTING.md](./ARCGIS_TESTING.md) for comprehensive ArcGIS integration testing.

---

## Connecting to ArcGIS Online

Once deployed, you can add your FeatureServer to ArcGIS Online.

### Steps:

1. **Get Your FeatureServer URL:**
   - Databricks Apps: `https://<workspace>.databricksapps.com/<app-id>/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0`
   - Standalone: `https://your-domain.com/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0`
   - Model Serving: `https://<workspace>.cloud.databricks.com/serving-endpoints/<name>/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0`

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

---

## Environment Variables

Configure these environment variables in your deployment:

| Variable | Description | Example |
|----------|-------------|---------  |
| `DATABRICKS_SERVER_HOSTNAME` | Workspace hostname | `e2-demo-field-eng.cloud.databricks.com` |
| `DATABRICKS_HTTP_PATH` | SQL Warehouse path | `/sql/1.0/warehouses/428aad03ef2b6b5f` |
| `DATABRICKS_TOKEN` | Authentication token | Use secrets management |
| `LOG_LEVEL` | Logging level | `INFO` or `DEBUG` |
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Server port | `8080` |

**Note:** When running on Databricks Apps, you can use Unity Catalog authentication instead of tokens.

---

## Security Best Practices

1. **Use Service Principal** instead of personal access tokens
2. **Store secrets** in proper secret management (Databricks Secrets, AWS Secrets Manager, etc.)
3. **Grant minimum permissions** (SELECT only on needed tables)
4. **Enable audit logging** in Databricks workspace
5. **Use HTTPS** (automatic with Databricks URLs, configure for standalone)
6. **Rate limiting** - Consider adding rate limits for public endpoints

---

## Additional Resources

- [Databricks Apps Documentation](https://docs.databricks.com/en/apps/index.html)
- [ArcGIS Testing Guide](./ARCGIS_TESTING.md)
- [ArcGIS REST API](https://developers.arcgis.com/rest/services-reference/enterprise/feature-service.htm)
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
