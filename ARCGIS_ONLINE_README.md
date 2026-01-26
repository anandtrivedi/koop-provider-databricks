# Making Koop Work with ArcGIS Online

## The Problem

Your Databricks Apps deployment works in a browser but **does NOT work with ArcGIS Online** because:

1. **Databricks Apps enforces OAuth authentication** (requires browser login with cookies)
2. **ArcGIS Online needs programmatic access** (cannot handle OAuth redirects)
3. **No way to bypass Databricks Apps OAuth** (even with `authentication.required: false`)

**Result:** ArcGIS Online gets 302 redirects → can't authenticate → fails to load layers ❌

---

## The Solution

Deploy Koop **outside of Databricks Apps** where you have full control over authentication.

---

## ✅ Recommended Solutions (No EC2 Required!)

### Option 1: Free Cloud Deployment (BEST for Production)

Deploy to **Render.com** (or Railway, Fly.io):
- ✅ **Free tier**: 750 hours/month
- ✅ **Permanent HTTPS URL**
- ✅ **No AWS permissions needed**
- ✅ **Works perfectly with ArcGIS Online**
- ⏱️ **Setup time**: 15 minutes

**📚 Full Guide:** `docs/DEPLOY_RENDER.md`

**Quick Steps:**
1. Push your code to GitHub
2. Sign up at Render.com (free, no credit card)
3. Create Web Service → Connect GitHub repo
4. Add environment variables (Databricks credentials)
5. Deploy → Get permanent URL like `https://koop-databricks.onrender.com`
6. Add to ArcGIS Online ✅

---

### Option 2: Local + Tunnel (BEST for Testing)

Run Koop locally + expose with **ngrok**:
- ✅ **Works immediately**
- ✅ **No deployment needed**
- ✅ **Perfect for testing**
- ⏱️ **Setup time**: 5 minutes

**📚 Full Guide:** `QUICK_START_NGROK.md`

**Quick Steps:**
```bash
# Terminal 1: Start Koop
cd /Users/anand.trivedi/Documents/gitprojects/koop-provider-databricks
npm start

# Terminal 2: Expose with ngrok
brew install ngrok  # One-time
ngrok http 8080

# Copy the https://...ngrok.io URL
# Add to ArcGIS Online ✅
```

**Limitations:**
- Your Mac must stay running
- URL changes on restart (free tier)
- 40 requests/minute limit

---

## Configuration Required

**Important:** Make sure `AUTH_MODE="disabled"` in your `.env` file:

```bash
# /Users/anand.trivedi/Documents/gitprojects/koop-provider-databricks/.env
DATABRICKS_SERVER_HOSTNAME="e2-demo-field-eng.cloud.databricks.com"
DATABRICKS_HTTP_PATH="/sql/1.0/warehouses/862f1d757f0424f7"
DATABRICKS_TOKEN="dapi_your_token_here"
AUTH_MODE="disabled"   ← Must be disabled!
LOG_LEVEL="INFO"
```

**Why disabled?**
- No authentication = ArcGIS Online can access directly
- Security handled by Databricks table permissions
- Simpler for testing and internal use

**Want authentication?** See `docs/AUTHENTICATION.md` for API key setup.

---

## Your Test Layers (Ready to Use!)

Once deployed (Render or ngrok), use these URLs:

### Cities (50 US cities - Point geometry)
```
https://YOUR-URL/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0
```

### Highways (5 major highways - LineString geometry)
```
https://YOUR-URL/databricks/rest/services/atrivedi.geospatial.koop_test_highways/FeatureServer/0
```

### States (5 US states - Polygon geometry)
```
https://YOUR-URL/databricks/rest/services/atrivedi.geospatial.koop_test_states/FeatureServer/0
```

### National Parks (10 parks - Point geometry)
```
https://YOUR-URL/databricks/rest/services/atrivedi.geospatial.koop_test_parks/FeatureServer/0
```

**Replace `YOUR-URL` with:**
- ngrok: `https://abc123.ngrok.io`
- Render: `https://koop-databricks.onrender.com`

---

## Testing Checklist

- [ ] Verify `.env` has `AUTH_MODE="disabled"`
- [ ] Choose deployment method (Render or ngrok)
- [ ] Deploy and get public HTTPS URL
- [ ] Test REST endpoint: `https://YOUR-URL/databricks/rest/info`
  - ✅ Should show: `"authInfo": {}`
- [ ] Test layer metadata: `https://YOUR-URL/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0?f=json`
- [ ] Add layer to ArcGIS Online Map Viewer
- [ ] Verify data loads and displays correctly

---

## Why Databricks Apps Doesn't Work

```
Flow with Databricks Apps (❌ FAILS):

ArcGIS Online
    │
    │ HTTP Request to /databricks/rest/services/...
    ▼
Databricks Apps
    │
    │ No OAuth cookie found
    │
    │ Returns 302 Redirect to OAuth login
    ▼
OAuth Login Page
    │
    ❌ ArcGIS Online can't handle browser login
    ❌ No way to get session cookie programmatically
    ❌ FAILS
```

```
Flow with Render/ngrok (✅ WORKS):

ArcGIS Online
    │
    │ HTTP Request to /databricks/rest/services/...
    ▼
Your Koop Server (Render/ngrok)
    │
    │ AUTH_MODE=disabled (no auth required)
    │ OR token passed in URL
    │
    │ Queries Databricks
    ▼
Returns GeoJSON
    │
    ✅ ArcGIS Online receives data
    ✅ Displays on map
    ✅ SUCCESS
```

---

## Documentation

📚 **Full guides available:**

1. **`QUICK_START_NGROK.md`** - Test with ngrok (5 minutes)
2. **`docs/DEPLOY_RENDER.md`** - Production deployment to Render.com (15 minutes)
3. **`docs/ARCGIS_ONLINE_SOLUTIONS.md`** - Detailed comparison of all options
4. **`docs/AUTHENTICATION.md`** - Optional API key authentication setup
5. **`TESTING_GUIDE.md`** - Authentication testing (if you enable it)

---

## Comparison Matrix

| Solution | Cost | Permanent URL | Setup Time | Works with ArcGIS Online |
|----------|------|---------------|------------|-------------------------|
| **Render.com** | Free | ✅ Yes | 15 min | ✅ Yes |
| **ngrok** | Free | ❌ Changes | 5 min | ✅ Yes |
| **Databricks Apps** | Free | ✅ Yes | N/A | ❌ No (OAuth) |

---

## Security Considerations

### For AUTH_MODE=disabled (no authentication):

**Risks:**
- Anyone with URL can access data
- No per-client tracking

**Mitigations:**
- Use Databricks table/schema permissions to restrict PAT token access
- Use Databricks network policies (IP allowlists)
- Monitor Databricks query logs
- Rotate DATABRICKS_TOKEN regularly

### For AUTH_MODE=enabled (API key authentication):

**See:** `docs/AUTHENTICATION.md` for full setup

**Benefits:**
- Client API keys map to server-side Databricks credentials
- Databricks PAT tokens never exposed
- Per-client access control
- Session token expiration

---

## Quick Decision Tree

**Need to test right now?**
→ Use **ngrok** (`QUICK_START_NGROK.md`)

**Need permanent public URL?**
→ Use **Render.com** (`docs/DEPLOY_RENDER.md`)

**Need authentication/access control?**
→ Enable AUTH_MODE + use Render/ngrok (`docs/AUTHENTICATION.md`)

**Can use EC2/AWS?**
→ See `docs/AWS_DEPLOYMENT.md` (if available)

---

## Next Steps

### Immediate (Choose One):

**Option A - Test Now (5 min):**
1. Read `QUICK_START_NGROK.md`
2. Run `npm start`
3. Run `ngrok http 8080`
4. Add to ArcGIS Online

**Option B - Production Deploy (15 min):**
1. Read `docs/DEPLOY_RENDER.md`
2. Push code to GitHub
3. Deploy to Render.com
4. Add to ArcGIS Online

### Later:

- **Enable authentication** if needed (`docs/AUTHENTICATION.md`)
- **Optimize performance** (`docs/PERFORMANCE_OPTIMIZATION.md`)
- **Configure multi-table access** (`docs/MULTI_TABLE_CONFIG.md`)

---

## Support & Questions

**Documentation:**
- All guides in `docs/` directory
- Start with `QUICK_START_NGROK.md` for fastest results

**Common Issues:**
- Authentication still showing? Check `.env` has `AUTH_MODE="disabled"`
- Layer 404? Verify `DATABRICKS_HTTP_PATH` in `.env`
- ArcGIS can't connect? Make sure using HTTPS URL

---

## Summary

✅ **Databricks Apps OAuth is incompatible with ArcGIS Online**
✅ **Solution: Deploy elsewhere** (Render.com or ngrok)
✅ **No EC2 required** (free cloud platforms work great)
✅ **Your data is ready** (4 test layers created in `atrivedi.geospatial`)
✅ **Full documentation provided** (see guides above)

**Recommended path:**
1. Test with ngrok (5 min)
2. Deploy to Render (15 min)
3. Add layers to ArcGIS Online ✅

---

**Ready to get started?** → Read `QUICK_START_NGROK.md` or `docs/DEPLOY_RENDER.md`
