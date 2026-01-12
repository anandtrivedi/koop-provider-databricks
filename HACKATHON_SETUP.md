# Hackathon Demo Setup Guide

This branch (`hackathon-pubsec-demo`) contains the complete demo including the Public Safety application with 32,000+ features deployed for the hackathon submission.

## What's Different in This Branch?

This hackathon branch includes additional files beyond the public version:

- **Public Safety Demo**: `examples/databricks-app/public/pubsec-demo.html` - Interactive map showing 32K+ features
  - 8,500 criminal cases (points)
  - 23,500 cell tower device counts (polygons)
  - Sample device location data
- **Data Exploration Scripts**: Tools to explore and create Koop views from the buildathon workspace
  - `explore-pubsec-tables.js` - Inspect pubsec_geo_law schema
  - `create-koop-views.js` - Create Koop-optimized views
  - `update-koop-views.js` - Update existing views

## Deployed Demo

**Live Application**: https://koop-esri-237438879023004.aws.databricksapps.com/

The app is deployed on Databricks Apps platform and showcases:
- Public Safety demo with 32K+ features
- Multi-layer map demo (70 features)
- Large dataset demo (10K records)

## Architecture Overview

This demo showcases a complete end-to-end geospatial data pipeline deployed on Databricks Apps:

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
│  │         │                   │  - cases_silver_koop │           │ │
│  │         │                   │  - cell_device_...   │           │ │
│  │         │                   │  - device_locations  │           │ │
│  │         │                   └──────────────────────┘           │ │
│  │         │                                                       │ │
│  │         ▼                                                       │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │            Static HTML Demo Pages                        │ │ │
│  │  │  - index.html (portal)                                   │ │ │
│  │  │  - pubsec-demo.html (32K+ features with ESRI JS API)    │ │ │
│  │  │  - multi-layer-map.html                                  │ │ │
│  │  │  - large-dataset-map.html                                │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Public URL: https://koop-esri-237438879023004.aws.databricksapps...│
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
2. **Databricks Provider**: Custom plugin that queries SQL Warehouse and converts WKT geometries
3. **SQL Warehouse**: Serverless compute that reads from Delta tables
4. **Demo HTML Pages**: Interactive maps built with ESRI JavaScript API 4.28
5. **Databricks Apps**: Containerized deployment platform with public URL

### Data Flow

1. Client requests features via FeatureServer API endpoint
2. Koop provider generates SQL query with filters/pagination
3. SQL Warehouse executes query on Delta tables
4. Provider converts WKT geometries to GeoJSON
5. Response formatted as ArcGIS FeatureServer JSON
6. Demo pages visualize data using ESRI JavaScript API

## Accessing the Buildathon Workspace

This demo uses data from the Databricks buildathon workspace:
- **Workspace**: fe-vm-industry-solutions-buildathon.cloud.databricks.com
- **SQL Warehouse**: ac513babbf5b5b8c
- **Schema**: pubsec_geo_law.demo

Judges/evaluators with access to this workspace can verify the deployment and data.

## Running Locally

To run this demo locally with the pubsec data:

```bash
cd examples/databricks-app

# Set environment variables (with your credentials)
export DATABRICKS_SERVER_HOSTNAME="fe-vm-industry-solutions-buildathon.cloud.databricks.com"
export DATABRICKS_HTTP_PATH="/sql/1.0/warehouses/ac513babbf5b5b8c"
export DATABRICKS_TOKEN="your-token-here"
export SERVE_DEMO_PAGES="true"

# Install dependencies
npm install

# Start the server
npm start
```

Then visit:
- http://localhost:8080 - Demo portal
- http://localhost:8080/pubsec-demo.html - Public Safety demo

## For Production Use

For production deployments, see the main repository:

- **Public Repository**: https://github.com/koopjs/koop-provider-databricks
- **Main Branch**: Contains simple demos that work with any Databricks workspace
- **Documentation**: Complete setup guides for using as Koop plugin or standalone deployment

The public version lets users create their own test data and doesn't require access to specific workspaces.

## Architecture Highlights

### Enterprise-Scale Demonstration
- Successfully serves 32,000+ geographic features
- Efficient pagination handles large datasets
- Supports multiple geometry types (Points, Polygons, LineStrings)
- Real-world data from public safety use case

### ArcGIS Compatibility
- Full FeatureServer REST API implementation
- Compatible with ArcGIS Pro, Online, JavaScript API
- Supports advanced queries (WHERE, spatial filters, field selection)
- Implements returnCountOnly and returnIdsOnly

### Databricks Integration
- Direct SQL Warehouse queries
- Automatic WKT to GeoJSON conversion
- Structured logging with request tracking
- Containerized deployment on Databricks Apps

## Technical Details

### Data Schema
The pubsec demo uses pre-created Koop views:
- `cases_silver_koop` - Criminal cases with geolocation
- `cell_device_counts_koop` - Cell tower coverage with device counts
- `device_locations_sample_koop` - Sample device tracking data

Views include:
- `objectid` - Auto-incrementing unique identifier
- `geometry` - WKT geometry column
- Domain-specific attributes (case_type, estimated_loss, device_count, etc.)

### Performance Metrics
Tested with buildathon workspace SQL Warehouse:
- Count queries: ~1.5s for 32K features
- Paginated queries: ~900ms per page (100 records)
- Spatial filtering: Efficient with proper indexing

### Security Notes
- Credentials use environment variables (not committed)
- App.yaml shows placeholders for configuration
- Production should use Databricks secret scopes

## Questions?

For technical questions about this hackathon submission:
- Review the deployed app: https://koop-esri-237438879023004.aws.databricksapps.com/
- Check the public repo: https://github.com/koopjs/koop-provider-databricks
- See DATABRICKS_APPS_DEPLOYMENT.md for deployment details
