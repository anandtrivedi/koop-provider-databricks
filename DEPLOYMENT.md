# Deployment Guide - Koop Databricks Provider

Complete guide for deploying and using the Koop Databricks provider with ArcGIS Online.

---

## Quick Start

### Current Deployment (Live and Working!)

**Status:** 🟢 **Live on Render.com**

```
URL:     https://koop-databricks.onrender.com
Data:    Databricks Community Edition
Auth:    Disabled (public access)
```

### Try it Now

Add this layer URL to ArcGIS Online:

```
https://koop-databricks.onrender.com/databricks/rest/services/geospatial.large_us_cities/FeatureServer/0
```

**Available Layers:**
- `geospatial.large_us_cities` - 10,000 US cities
- `geospatial.koop_test_cities` - 10 major cities
- `geospatial.koop_test_highways` - Interstate highways
- `geospatial.koop_test_states` - State polygons
- `geospatial.koop_test_parks` - National parks

---

## Architecture Overview

### How It Works

```
ArcGIS Online/Pro
    ↓ HTTPS Request (FeatureServer protocol)
Render.com (or your server)
    ↓ Koop translates request to SQL
Databricks SQL Warehouse
    ↓ Returns geospatial data
Koop converts to GeoJSON
    ↓ FeatureServer response
ArcGIS displays on map
```

### Why Databricks Apps Doesn't Work

**Question:** Can I deploy to Databricks Apps instead of Render.com?

**Answer:** ❌ **NO** - Databricks Apps enforces OAuth authentication that blocks ArcGIS Online.

**The Problem:**
- Databricks Apps requires browser-based OAuth login
- ArcGIS Online makes programmatic API requests (no browser)
- Requests get blocked with 302 redirect before reaching your app
- This happens even if AUTH_MODE=disabled in your Koop config

**The Solution:**
Deploy to a platform where you control the HTTP endpoint:
- ✅ Render.com (testing/demo)
- ✅ AWS EC2 / Azure VM (production)
- ✅ Docker containers (any cloud)
- ✅ Kubernetes clusters

---

## Deployment Options

### Option 1: Render.com (Testing & Demo)

**Best for:** Testing with Databricks Community Edition

**Pros:**
- ✅ Free tier (750 hours/month)
- ✅ Auto-deploy from GitHub
- ✅ HTTPS included
- ✅ Simple setup (10 minutes)

**Cons:**
- ⚠️ Sleeps after 15 min inactivity (first request takes ~30 seconds)
- ⚠️ Shared resources

**Setup:**

1. **Fork the repo** on GitHub

2. **Create Render.com account** (free)

3. **Create Web Service:**
   - Connect GitHub repo
   - Branch: `dev` (or `main`)
   - Build: `npm install`
   - Start: `npm start`

4. **Set environment variables:**
   ```bash
   DATABRICKS_SERVER_HOSTNAME=your-workspace.cloud.databricks.com
   DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/your-warehouse-id
   DATABRICKS_TOKEN=dapi_your_token  # gitleaks:allow
   AUTH_MODE=disabled
   LOG_LEVEL=INFO
   ```

5. **Deploy** - Render auto-builds and provides HTTPS URL

---

### Option 2: AWS EC2 / Azure VM (Production)

**Best for:** Production with Enterprise Databricks

**Setup Steps:**

1. **Launch instance:**
   - Type: t3.medium minimum
   - OS: Ubuntu 22.04 or Amazon Linux 2
   - Security: Allow inbound 443 (HTTPS)

2. **Install Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```

3. **Clone and configure:**
   ```bash
   git clone https://github.com/anandtrivedi/koop-provider-databricks.git
   cd koop-provider-databricks
   npm install
   ```

4. **Create `.env`:**
   ```bash
   DATABRICKS_SERVER_HOSTNAME=your-prod-workspace.cloud.databricks.com
   DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/prod-warehouse-id
   DATABRICKS_TOKEN=dapi_production_token  # gitleaks:allow
   AUTH_MODE=enabled  # Enable for production
   LOG_LEVEL=INFO
   ```

5. **Set up PM2 (process manager):**
   ```bash
   sudo npm install -g pm2
   pm2 start npm --name koop -- start
   pm2 save
   pm2 startup
   ```

6. **Configure Nginx (reverse proxy):**
   ```nginx
   server {
       listen 443 ssl;
       server_name yourdomain.com;

       ssl_certificate /etc/ssl/certs/cert.pem;
       ssl_certificate_key /etc/ssl/private/key.pem;

       location / {
           proxy_pass http://localhost:8080;
           proxy_set_header Host $host;
       }
   }
   ```

---

### Option 3: Docker (Any Platform)

**Dockerfile included in repo:**

```bash
# Build
docker build -t koop-databricks .

# Run
docker run -d \
  -p 8080:8080 \
  -e DATABRICKS_SERVER_HOSTNAME="workspace.cloud.databricks.com" \
  -e DATABRICKS_HTTP_PATH="/sql/1.0/warehouses/warehouse-id" \
  -e DATABRICKS_TOKEN="dapi_token" \
  -e AUTH_MODE="disabled" \
  --name koop-databricks \
  koop-databricks
```

Deploy to:
- AWS ECS/Fargate
- Azure Container Instances
- Google Cloud Run
- Any Docker host

---

## Authentication (Optional)

### When to Enable Authentication

**Use AUTH_MODE=disabled (default) for:**
- ✅ Public/demo data
- ✅ Testing environments
- ✅ Open government data
- ✅ Internal use with URL sharing

**Use AUTH_MODE=enabled for:**
- 🔐 Sensitive data (PII, financial, health)
- 🔐 Multi-tenant deployments
- 🔐 Per-client access control
- 🔐 Usage tracking requirements

### How Authentication Works

When `AUTH_MODE=enabled`:

**Step 1:** Client requests session token
```bash
POST https://your-server.com/databricks/tokens/
Body: { "apiKey": "client-key-12345" }

Response: {
  "token": "abc123...",
  "expires": 1234567890,
  "ssl": true
}
```

**Step 2:** Client uses token in requests
```
https://your-server.com/databricks/rest/services/schema.table/FeatureServer/0?token=abc123...
```

### Enable Authentication

1. **Create `config/auth.json`:**
   ```json
   {
     "clients": {
       "team-alpha-key": {
         "name": "Team Alpha",
         "description": "Access to alpha project data",
         "databricks": {
           "token": "dapi_team_alpha_token",
           "serverHostname": "workspace.cloud.databricks.com",
           "httpPath": "/sql/1.0/warehouses/alpha-warehouse"
         }
       },
       "team-beta-key": {
         "name": "Team Beta",
         "databricks": {
           "token": "dapi_team_beta_token",
           "serverHostname": "workspace.cloud.databricks.com",
           "httpPath": "/sql/1.0/warehouses/beta-warehouse"
         }
       }
     }
   }
   ```

2. **Set environment variable:**
   ```bash
   AUTH_MODE=enabled
   ```

3. **Restart server**

4. **Distribute API keys to clients** (securely!)

**Security Features:**
- ✅ Session tokens expire after 1 hour
- ✅ Each client can map to different Databricks credentials
- ✅ Databricks PAT tokens never exposed to clients
- ✅ Server-side validation
- ✅ Per-client usage tracking (in logs)

---

## Security Considerations

### Current Setup (AUTH_MODE=disabled)

**What's Secure:**
- ✅ HTTPS encryption (TLS 1.2+)
- ✅ Databricks PAT token stored server-side only
- ✅ Read-only operations (no INSERT/UPDATE/DELETE)

**What's Not Secure:**
- ⚠️ No client authentication (anyone with URL can access)
- ⚠️ No usage tracking per client
- ⚠️ URL is public (though obscure)

**Acceptable For:**
- Public datasets
- Demo/testing environments
- Internal tools with URL sharing
- Open government data

**NOT Acceptable For:**
- Personal Identifiable Information (PII)
- Financial data
- Healthcare data (HIPAA)
- Proprietary business intelligence

### Production Security Checklist

- [ ] Enable `AUTH_MODE=enabled` for sensitive data
- [ ] Use dedicated service account PAT tokens (not personal tokens)
- [ ] Limit Databricks token permissions (read-only, specific schemas)
- [ ] Rotate tokens quarterly (document in calendar)
- [ ] Configure HTTPS/TLS with valid certificates
- [ ] Set up VPC/firewall rules
- [ ] Enable monitoring and alerting
- [ ] Configure centralized logging
- [ ] Document security controls for compliance
- [ ] Review and test disaster recovery plan

---

## Testing with ngrok (Local Development)

Want to test locally before deploying?

```bash
# Terminal 1: Start Koop
npm start

# Terminal 2: Expose via ngrok
ngrok http 8080
```

Use the ngrok HTTPS URL in ArcGIS Online:
```
https://abc123.ngrok.io/databricks/rest/services/schema.table/FeatureServer/0
```

**Note:** ngrok free tier URLs change on restart.

---

## Data Requirements

### Table Schema

Your Databricks tables must have:

1. **Geometry column** (one of):
   - `geometry_wkt` (WKT format) - Recommended
   - `geometry` (WKT format)
   - `geom` (WKT format)
   - `wkt` (WKT format)

2. **Geometry types supported:**
   - `POINT(lon lat)` - For point features
   - `LINESTRING(...)` - For lines/polylines
   - `POLYGON(...)` - For polygons
   - `MULTIPOINT`, `MULTILINESTRING`, `MULTIPOLYGON`

### Example Table Creation

```sql
-- Create schema
CREATE SCHEMA IF NOT EXISTS my_catalog.geospatial;

-- Create table with geometry
CREATE TABLE my_catalog.geospatial.cities (
  city_id INT,
  city_name STRING,
  state STRING,
  population INT,
  geometry_wkt STRING  -- WKT format: 'POINT(-118.2437 34.0522)'
);

-- Insert data
INSERT INTO my_catalog.geospatial.cities VALUES
  (1, 'Los Angeles', 'California', 3900000, 'POINT(-118.2437 34.0522)'),
  (2, 'New York', 'New York', 8400000, 'POINT(-74.0060 40.7128)');
```

### Unity Catalog Naming

**Community Edition:**
- Catalog: `workspace` (implicit)
- Schema: `geospatial` (your choice)
- Table: `cities` (your choice)
- URL format: `geospatial.cities` (2-part name)

**Enterprise with Unity Catalog:**
- Catalog: `my_catalog` (your choice)
- Schema: `geospatial` (your choice)
- Table: `cities` (your choice)
- URL format: `my_catalog.geospatial.cities` (3-part name)

**Provider handles both formats automatically!**

---

## Troubleshooting

### Issue: Layer won't load in ArcGIS Online

**Check:**
1. Is the server running? Test: `curl https://your-url/databricks/rest/info`
2. Does the table exist? Check Databricks SQL Editor
3. Does the table have `geometry_wkt` column?
4. Is the URL formatted correctly? Should end with `/FeatureServer/0`
5. Check server logs for errors

### Issue: Render.com deployment sleeps

**Solution:** First request after 15 min inactivity takes ~30 seconds to wake up. This is normal for free tier.

**Workaround:** Upgrade to Render paid tier ($7/month) for no-sleep behavior.

### Issue: "Authentication required" error

**Check:**
1. Is `AUTH_MODE=enabled`? If so, you need to request a token first
2. Is the token expired? Tokens expire after 1 hour
3. Is the token included in the URL? Add `?token=your_token`

### Issue: Databricks token expired

**Symptoms:** 401 errors, "Invalid access token" in logs

**Solution:**
1. Generate new PAT token in Databricks (User Settings → Access Tokens)
2. Update environment variable: `DATABRICKS_TOKEN=new_token`
3. Restart server

### Issue: Git commit blocked (secret detected)

**Cause:** Git hook detects Databricks tokens in committed files

**Solution:** Don't commit tokens to git:
- Store in `.env` (gitignored)
- Or use environment variables on your hosting platform
- Or add `# gitleaks:allow` comment if intentional (e.g., docs with placeholder tokens)

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABRICKS_SERVER_HOSTNAME` | Yes | - | Databricks workspace hostname |
| `DATABRICKS_HTTP_PATH` | Yes | - | SQL Warehouse HTTP path |
| `DATABRICKS_TOKEN` | Yes* | - | PAT token (required if AUTH_MODE=disabled) |
| `AUTH_MODE` | No | `disabled` | Authentication mode: `disabled` or `enabled` |
| `PORT` | No | `8080` | Server port |
| `LOG_LEVEL` | No | `INFO` | Log level: `DEBUG`, `INFO`, `WARN`, `ERROR` |
| `TOKEN_EXPIRATION_SECONDS` | No | `3600` | Session token TTL (1 hour) |
| `KOOP_AUTH_HTTP` | No | `false` | Allow HTTP for tokens (testing only) |

---

## Performance Notes

### Render.com Free Tier
- Sleeps after 15 min inactivity
- First request: ~30 seconds (wake up)
- Subsequent requests: <1-3 seconds
- 750 hours/month (enough for 24/7)

### Production Server (EC2/VM)
- No sleep behavior
- Consistent <1-3 second response
- Performance depends on:
  - Server resources (CPU/RAM)
  - Databricks warehouse size
  - Dataset size
  - Query complexity

### Optimization Tips
- Use appropriate Databricks warehouse size
- Add indexes on frequently queried columns
- Use Delta Lake for better query performance
- Enable ArcGIS caching for static layers
- Consider CDN for high-traffic deployments

---

## Migration: Community Edition → Enterprise

**Step 1: Test with Community Edition** (Current)
- ✅ Render.com deployment
- ✅ AUTH_MODE=disabled
- ✅ Public demo data

**Step 2: Deploy Production Server**
- 🔄 Set up EC2/VM/Docker
- 🔄 Configure Nginx/SSL
- 🔄 Enable AUTH_MODE=enabled
- 🔄 Test with internal users

**Step 3: Connect Enterprise Databricks**
- 🔄 Update DATABRICKS_SERVER_HOSTNAME
- 🔄 Update DATABRICKS_HTTP_PATH (production warehouse)
- 🔄 Update DATABRICKS_TOKEN (service account)
- 🔄 Update auth.json (per-client credentials)

**Step 4: Go Live**
- 🔄 Configure monitoring
- 🔄 Set up alerts
- 🔄 Document runbook
- 🔄 Train users
- 🔄 Roll out to all users

---

## Support & Resources

**Documentation:**
- Main README: `README.md`
- Authentication details: `docs/AUTHENTICATION.md`
- Change log: `CHANGELOG.md`

**External Resources:**
- Render Dashboard: https://dashboard.render.com
- ArcGIS Online: https://www.arcgis.com
- Databricks Docs: https://docs.databricks.com
- Koop.js: https://koopjs.github.io

**Troubleshooting:**
- Check server logs (Render Dashboard → Logs, or PM2 logs)
- Check Databricks SQL Editor → Query History
- Test REST endpoints with curl or browser

---

## Summary

**Current Status:**
- ✅ **Deployed on Render.com** (https://koop-databricks.onrender.com)
- ✅ **Working with ArcGIS Online**
- ✅ **6 test layers available** (10,000+ features)
- ✅ **No authentication required** (demo mode)
- ✅ **HTTPS encrypted**
- ✅ **Free hosting**

**Databricks Apps:**
- ❌ **Does NOT work with ArcGIS Online**
- ❌ **OAuth blocks programmatic access**
- ❌ **Not available on Community Edition**
- ✅ **Use separate server instead** (Render/EC2/Docker)

**Production Ready:**
- ✅ **Authentication available** (AUTH_MODE=enabled)
- ✅ **Multiple deployment options** (EC2, Docker, K8s)
- ✅ **Security documented**
- ✅ **Tested and working**

**Get Started:**
Just paste a layer URL into ArcGIS Online and start visualizing your Databricks geospatial data!

```
https://koop-databricks.onrender.com/databricks/rest/services/geospatial.large_us_cities/FeatureServer/0
```
