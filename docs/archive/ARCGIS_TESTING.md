# Testing Koop Provider with ArcGIS

This guide explains how to test the Databricks Koop provider with real ArcGIS clients.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Testing with ArcGIS Online](#testing-with-arcgis-online)
3. [Testing with ArcGIS Pro](#testing-with-arcgis-pro)
4. [Testing with ArcGIS JavaScript API](#testing-with-arcgis-javascript-api)
5. [Testing with ArcGIS REST API Explorer](#testing-with-arcgis-rest-api-explorer)
6. [Public URL Requirements](#public-url-requirements)
7. [Example Integration](#example-integration)

---

## Prerequisites

### 1. Public URL for Your Koop Server

**ArcGIS Online and most ArcGIS clients require a publicly accessible URL.** Your local `http://localhost:8080` won't work from ArcGIS Online.

**Options for making your local server public:**

#### Option A: ngrok (Recommended for Testing)
```bash
# Install ngrok
brew install ngrok

# Start your Koop server
npm start

# In another terminal, create public tunnel
ngrok http 8080

# ngrok will display a public URL like:
# https://abc123.ngrok.io
```

Use this public URL in place of `http://localhost:8080` for all ArcGIS testing.

#### Option B: Deploy to Cloud
- Deploy to AWS, Azure, GCP, or Databricks serving
- Ensure port 8080 (or configured port) is open
- Configure HTTPS/SSL for production use

#### Option C: Cloudflare Tunnel
```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Start tunnel
cloudflared tunnel --url http://localhost:8080
```

#### Option D: Databricks Apps (Recommended for Production)

If you've deployed your Koop provider to **Databricks Apps**, you already have a public URL! Databricks Apps provides a publicly accessible HTTPS URL out of the box:

```
https://<workspace-id>.cloud.databricks.com/apps/<app-id>/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0
```

**Benefits:**
- ✅ **HTTPS by default** - No SSL configuration needed
- ✅ **Stable URL** - Doesn't change between deployments
- ✅ **Production-ready** - Scales automatically with your workspace
- ✅ **No tunneling required** - Direct public access

**Example:**
```
https://your-workspace.cloud.databricks.com/apps/koop-provider/databricks/rest/services/main.default.cities/FeatureServer/0
```

See [DATABRICKS_DEPLOYMENT.md](./DATABRICKS_DEPLOYMENT.md) for full deployment instructions.

---

## Testing with ArcGIS Online

ArcGIS Online can consume Feature Services through "Add Data from URL".

### Steps:

1. **Get Public URL** (using ngrok or other method):
   ```
   https://your-ngrok-url.ngrok.io/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0
   ```

2. **Add to ArcGIS Online Map**:
   - Go to [ArcGIS Online](https://www.arcgis.com)
   - Create a new Web Map
   - Click "Add" → "Add Layer from URL"
   - Select "An ArcGIS Server Web Service"
   - Paste your FeatureServer URL
   - Click "Add Layer"

3. **Test Functionality**:
   - **Pan/Zoom**: Verify features render at all zoom levels
   - **Attribute Table**: Click on layer → "Show Table" to view attributes
   - **Query**: Use "Filter" to test WHERE clauses
   - **Pop-ups**: Click on features to test attribute display
   - **Symbology**: Change rendering styles
   - **Analysis**: Run spatial analysis tools

### Expected Behavior:
- ✅ Features should appear on the map
- ✅ Clicking features shows attribute pop-ups
- ✅ Filtering works (WHERE clauses)
- ✅ Spatial queries work (bbox filters)
- ✅ Pagination loads additional features on demand

---

## Testing with ArcGIS Pro

ArcGIS Pro can connect to Feature Services directly.

### Steps:

1. **Open ArcGIS Pro** and create a new project

2. **Add Connection**:
   - In the Catalog pane, right-click "Servers"
   - Select "New ArcGIS Server Connection"
   - **Server URL**: `https://your-ngrok-url.ngrok.io/databricks/rest/services`
   - **Authentication**: None (unless you add authentication to Koop)
   - Click "OK"

3. **Add Layer**:
   - Expand your server connection
   - Drag `main.default.koop_test_cities` to the map
   - Features should render

4. **Test Functionality**:
   - **Identify**: Click features to view attributes
   - **Select by Attributes**: Test WHERE clause queries
   - **Select by Location**: Test spatial queries
   - **Geoprocessing**: Run analysis tools
   - **Export**: Export to local geodatabase

---

## Testing with ArcGIS JavaScript API

Create an interactive web map using the ArcGIS JavaScript API.

### Example HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Koop Databricks Provider Test</title>
  <style>
    html, body, #viewDiv {
      padding: 0;
      margin: 0;
      height: 100%;
      width: 100%;
    }
  </style>
  <link rel="stylesheet" href="https://js.arcgis.com/4.28/esri/themes/light/main.css">
  <script src="https://js.arcgis.com/4.28/"></script>
  <script>
    require([
      "esri/Map",
      "esri/views/MapView",
      "esri/layers/FeatureLayer"
    ], function(Map, MapView, FeatureLayer) {

      // Replace with your public URL
      const featureLayer = new FeatureLayer({
        url: "https://your-ngrok-url.ngrok.io/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0",
        outFields: ["*"],
        popupTemplate: {
          title: "{city_name}, {state}",
          content: "Population: {population:NumberFormat}"
        }
      });

      const map = new Map({
        basemap: "topo-vector",
        layers: [featureLayer]
      });

      const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-95, 38], // Center of USA
        zoom: 4
      });

      // Test query functionality
      view.whenLayerView(featureLayer).then(function(layerView) {
        console.log("Layer loaded successfully");

        // Test attribute query
        featureLayer.queryFeatures({
          where: "population > 1000000",
          returnGeometry: true,
          outFields: ["*"]
        }).then(function(results) {
          console.log("Query results:", results.features.length, "features");
        });
      });
    });
  </script>
</head>
<body>
  <div id="viewDiv"></div>
</body>
</html>
```

### Test Scenarios:
1. **Load layer** - verify features render
2. **Click features** - verify pop-ups display
3. **Query features** - test `queryFeatures()` with WHERE clauses
4. **Zoom/Pan** - verify performance at different scales
5. **Browser console** - check for errors

---

## Testing with ArcGIS REST API Explorer

The REST API Explorer is great for testing FeatureServer compliance without GIS software.

### URL to Test:
```
https://your-ngrok-url.ngrok.io/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0
```

### Key Endpoints to Test:

#### 1. Service Metadata
```
GET /FeatureServer/0
```
Should return layer schema, fields, extent

#### 2. Query Features
```
GET /FeatureServer/0/query?where=1=1&returnGeometry=true&outFields=*&f=json
```

#### 3. Query with Filter
```
GET /FeatureServer/0/query?where=state='California'&outFields=*&f=json
```

#### 4. Spatial Query (bbox)
```
GET /FeatureServer/0/query?geometry=-125,30,-115,50&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&outFields=*&f=json
```

#### 5. Pagination
```
GET /FeatureServer/0/query?where=1=1&resultRecordCount=3&resultOffset=0&outFields=*&f=json
```

#### 6. Return Count Only
```
GET /FeatureServer/0/query?where=1=1&returnCountOnly=true&f=json
```

#### 7. Return IDs Only
```
GET /FeatureServer/0/query?where=1=1&returnIdsOnly=true&f=json
```

---

## Public URL Requirements

### Network Configuration

When deploying to production, ensure:

1. **HTTPS/SSL**: ArcGIS Online requires HTTPS in production
   - Use Let's Encrypt for free certificates
   - Or use a reverse proxy (nginx, Apache) with SSL

2. **CORS Headers**: Enable Cross-Origin Resource Sharing
   - Koop automatically handles CORS
   - But verify if using a reverse proxy

3. **Firewall**: Open required ports
   - Port 80 (HTTP)
   - Port 443 (HTTPS)

4. **DNS**: Configure proper domain name
   - Better than IP address for ArcGIS Online
   - Example: `koop-databricks.your-domain.com`

### Example nginx Configuration:
```nginx
server {
    listen 443 ssl;
    server_name koop-databricks.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CORS headers (if needed)
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
    }
}
```

---

## Example Integration

### Complete Test Workflow

1. **Start Koop Server**:
   ```bash
   npm start
   ```

2. **Create Public URL** (ngrok):
   ```bash
   ngrok http 8080
   # Copy the HTTPS URL: https://abc123.ngrok.io
   ```

3. **Test in ArcGIS Online**:
   - URL: `https://abc123.ngrok.io/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0`
   - Add to web map
   - Verify features render
   - Test filtering, pop-ups, queries

4. **Test in Browser** (JavaScript API):
   - Create HTML file from example above
   - Replace URL with your ngrok URL
   - Open in browser
   - Check console for errors

5. **Test with cURL**:
   ```bash
   curl "https://abc123.ngrok.io/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?where=1=1&returnCountOnly=true&f=json"
   ```

---

## Troubleshooting

### Issue: "Layer failed to load" in ArcGIS Online

**Possible causes:**
1. URL not publicly accessible (check ngrok status)
2. CORS issues (usually auto-handled by Koop)
3. Invalid GeoJSON (check server logs)
4. Missing metadata (objectIdFieldName, etc.)

**Solution:**
- Test URL directly in browser first
- Check browser console for CORS errors
- Verify FeatureServer metadata endpoint loads

### Issue: Features don't render

**Possible causes:**
1. Invalid geometry (check ST_AsGeoJSON output)
2. Wrong spatial reference (verify WKID = 4326)
3. Features outside visible extent

**Solution:**
- Test `/query?where=1=1&returnGeometry=false` to isolate geometry issues
- Check extent in layer metadata
- Verify coordinates are in correct order (x, y = lon, lat)

### Issue: Slow performance

**Possible causes:**
1. No indexes on table
2. Large result sets without pagination
3. Complex spatial queries

**Solution:**
- Add indexes to Databricks table on objectid, geometry
- Enforce maxRecordCount limits
- Use server-side pagination (already implemented via `filtersApplied`)

---

## Best Practices for Production

1. **Use HTTPS**: Required for ArcGIS Online
2. **Add Authentication**: Protect sensitive data
3. **Rate Limiting**: Prevent abuse
4. **Caching**: Use CDN for static assets
5. **Monitoring**: Log queries and performance metrics
6. **Indexes**: Add spatial indexes to Databricks tables
7. **Error Handling**: Return proper error messages
8. **Documentation**: Provide API documentation for consumers

---

## Additional Resources

- [ArcGIS REST API Documentation](https://developers.arcgis.com/rest/)
- [ArcGIS JavaScript API](https://developers.arcgis.com/javascript/)
- [Koop Documentation](https://koopjs.github.io/)
- [ngrok Documentation](https://ngrok.com/docs)
- [FeatureServer Specification](https://developers.arcgis.com/rest/services-reference/enterprise/feature-service.htm)

---

## Next Steps

1. Deploy Koop server to cloud environment
2. Configure domain and SSL
3. Test with ArcGIS Online and Pro
4. Gather user feedback
5. Optimize performance based on usage patterns
6. Add authentication if needed
7. Set up monitoring and logging
