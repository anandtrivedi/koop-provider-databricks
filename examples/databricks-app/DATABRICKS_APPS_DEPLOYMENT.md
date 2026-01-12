# Deploying Koop Provider to Databricks Apps

This guide explains how to deploy the Koop Databricks Provider as a Databricks App.

## Architecture Overview

This deployment creates a complete end-to-end geospatial data pipeline on Databricks Apps:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Databricks Apps Platform                      │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   Containerized Koop Server                     │ │
│  │                                                                  │ │
│  │  ┌──────────────┐        ┌─────────────────────────────────┐  │ │
│  │  │              │        │   Koop Databricks Provider       │  │ │
│  │  │   Express    │──────▶│   - Model (SQL queries)          │  │ │
│  │  │   Server     │        │   - Controller (API endpoints)   │  │ │
│  │  │   (Node.js)  │        │   - WKT to GeoJSON conversion    │  │ │
│  │  │              │        │   - Pagination & filtering       │  │ │
│  │  └──────┬───────┘        └────────────┬────────────────────┘  │ │
│  │         │                              │                        │ │
│  │         │                              │ SQL Queries            │ │
│  │         │ Serves                       ▼                        │ │
│  │         │                   ┌──────────────────────┐           │ │
│  │         │                   │  SQL Warehouse       │           │ │
│  │         │                   │  (Serverless)        │           │ │
│  │         │                   └──────────┬───────────┘           │ │
│  │         │                              │                        │ │
│  │         │                              │ Reads from             │ │
│  │         │                              ▼                        │ │
│  │         │                   ┌──────────────────────┐           │ │
│  │         │                   │  Delta Tables        │           │ │
│  │         │                   │  (with WKT geometry) │           │ │
│  │         │                   └──────────────────────┘           │ │
│  │         │                                                       │ │
│  │         ▼                                                       │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │            Static HTML Demo Pages (Optional)             │ │ │
│  │  │  - index.html (portal)                                   │ │ │
│  │  │  - multi-layer-map.html                                  │ │ │
│  │  │  - large-dataset-map.html                                │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Public URL: https://your-app.aws.databricksapps.com                │
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

1. **Koop Server (Node.js)**: Translates between Databricks tables and ArcGIS FeatureServer API
2. **Databricks Provider**: Custom plugin that queries SQL Warehouse and converts WKT geometries to GeoJSON
3. **SQL Warehouse**: Serverless compute that reads from Delta tables
4. **Demo HTML Pages**: Interactive maps built with ESRI JavaScript API 4.28 (optional)
5. **Databricks Apps**: Containerized deployment platform with public HTTPS URL

### Data Flow

1. Client requests features via FeatureServer API endpoint
2. Koop provider generates SQL query with filters/pagination
3. SQL Warehouse executes query on Delta tables
4. Provider converts WKT geometries to GeoJSON
5. Response formatted as ArcGIS FeatureServer JSON
6. Client applications visualize data using ArcGIS tools

## Prerequisites

- Databricks workspace with Apps enabled
- Databricks CLI installed and configured
- Docker installed (for local testing)

## Deployment Method 1: Databricks UI (Recommended)

This is the easiest method for first-time deployment.

### Steps:

1. **Access Databricks Apps**
   - Go to your Databricks workspace
   - Navigate to: **Apps** → **Create App**

2. **Create New App**
   - **Name**: `koop-databricks-provider` (or your preferred name)
   - **Description**: "ArcGIS FeatureServer REST API for Databricks geospatial data"

3. **Upload Source Code**
   - Upload the entire `examples/databricks-app/` directory
   - Or connect to your GitHub repository

4. **Configure Environment Variables**
   ```
   DATABRICKS_SERVER_HOSTNAME={{workspace.host}}
   DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/YOUR_WAREHOUSE_ID
   DATABRICKS_TOKEN={{secrets.databricks_token}}
   PORT=8080
   LOG_LEVEL=INFO
   SERVE_DEMO_PAGES=true
   ```

5. **Set Dockerfile**
   - Ensure `Dockerfile` is in the root of your uploaded code
   - The platform will automatically detect and use it

6. **Deploy**
   - Click **Deploy**
   - Wait for the build and deployment process (5-10 minutes)
   - Once deployed, you'll get a public HTTPS URL

7. **Access Your App**
   ```
   https://koop-databricks-provider-WORKSPACE_ID.aws.databricksapps.com
   ```

## Deployment Method 2: Workspace Files + CLI

### Step 1: Upload Code to Workspace

```bash
# Navigate to the databricks-app directory
cd examples/databricks-app

# Upload to workspace
databricks workspace import-dir . /Workspace/Users/your.email@company.com/koop-provider --profile DEFAULT
```

### Step 2: Create App

```bash
# Create the app
databricks apps create koop-databricks-provider --description "ArcGIS FeatureServer for Databricks" --profile DEFAULT
```

### Step 3: Deploy App

```bash
# Deploy from workspace path
databricks apps deploy koop-databricks-provider \
  --source-code-path /Workspace/Users/your.email@company.com/koop-provider \
  --mode AUTO_SYNC \
  --profile DEFAULT
```

## Deployment Method 3: Git Integration

If you have your code in GitHub:

1. **In Databricks UI**:
   - Apps → Create App
   - Choose **Git** as source
   - Enter repository URL: `https://github.com/yourusername/koop-provider-databricks`
   - Path: `examples/databricks-app/`
   - Branch: `feature/v0.2-improvements` or `main`

2. **Configure as above** with environment variables

3. **Enable auto-sync** for automatic deployments on git push

## Testing Your Deployment

Once deployed, test the following endpoints:

### 1. Service Info
```
https://your-app-url.databricksapps.com/databricks/rest/info
```

### 2. Feature Layer
```
https://your-app-url.databricksapps.com/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0
```

### 3. Demo Pages (if SERVE_DEMO_PAGES=true)
```
https://your-app-url.databricksapps.com/
https://your-app-url.databricksapps.com/multi-layer-map.html
https://your-app-url.databricksapps.com/large-dataset-map.html
```

## Using with ArcGIS Online

Once deployed, add your layer to ArcGIS Online:

1. **In ArcGIS Online**: Map → Add → Add Layer from Web
2. **Type**: ArcGIS Server Web Service
3. **URL**: `https://your-app-url.databricksapps.com/databricks/rest/services/main.default.your_table/FeatureServer/0`
4. **Add to Map**

The layer will now be available in ArcGIS Online with full pagination, spatial filtering, and querying support!

## Monitoring and Logs

- **View logs**: Databricks Apps UI → Your App → Logs
- **Monitor performance**: Check compute status and deployment status
- **Update**: Push code to git (if using git integration) or redeploy via CLI

## Troubleshooting

### Build Fails
- Check Dockerfile syntax
- Ensure all dependencies in package.json
- Check Node.js version compatibility

### App Won't Start
- Verify environment variables are set correctly
- Check logs for startup errors
- Ensure warehouse ID is correct and accessible

### Can't Access from ArcGIS Online
- Verify app is in ACTIVE state
- Check URL is publicly accessible
- Test with curl first to verify API responses

## Deployment Options

### Option A: API Only
Set `SERVE_DEMO_PAGES=false` for production deployments where users will consume via their own ArcGIS tools.

### Option B: Full Solution
Set `SERVE_DEMO_PAGES=true` to include the interactive demo pages for showcasing capabilities.

## Resource Configuration

The app.yaml supports configuring compute resources:

```yaml
compute:
  size: "small"   # Options: small, medium, large

# Optional auto-scaling
scale:
  min: 1
  max: 3
```

For production workloads with many concurrent users, consider using medium or large compute with auto-scaling enabled.
