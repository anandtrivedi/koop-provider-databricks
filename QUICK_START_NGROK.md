# Quick Start: Test with ArcGIS Online using ngrok

This guide will get you up and running in **5 minutes** so you can test with ArcGIS Online.

---

## Why This Works

- **Databricks Apps** = OAuth (browser only) ❌ Won't work with ArcGIS Online
- **Local Koop + ngrok** = Direct access ✅ Works with ArcGIS Online!

---

## Prerequisites

```bash
# Install ngrok (one-time setup)
brew install ngrok
```

---

## Step 1: Start Koop Locally

```bash
cd /Users/anand.trivedi/Documents/gitprojects/koop-provider-databricks

# Make sure AUTH_MODE is disabled
cat .env  # Should show: AUTH_MODE="disabled"

# If not, edit it:
# nano .env
# Change AUTH_MODE="enabled" to AUTH_MODE="disabled"

# Start Koop
npm start
```

**Expected output:**
```
Authentication disabled for Databricks provider (using environment variables)
Server listening at http://localhost:8080
```

---

## Step 2: Expose with ngrok (New Terminal)

```bash
# In a NEW terminal window
ngrok http 8080
```

**Expected output:**
```
Forwarding  https://abc123xyz456.ngrok.io -> http://localhost:8080
```

**Copy the `https://...ngrok.io` URL** - this is your public URL!

---

## Step 3: Test Your Endpoints

Replace `abc123xyz456.ngrok.io` with YOUR ngrok URL:

### Test REST Info
```bash
curl https://abc123xyz456.ngrok.io/databricks/rest/info
```

**Expected:**
```json
{
  "currentVersion": 11.2,
  "fullVersion": "11.2.0",
  "authInfo": {},  ← Empty = No authentication required!
  "metadata": {"maxRecordCount": 2000}
}
```

### Test Cities Layer
```bash
curl "https://abc123xyz456.ngrok.io/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0?f=json"
```

**Expected:** Layer metadata with geometry type, fields, extent, etc.

---

## Step 4: Add to ArcGIS Online

1. Go to **ArcGIS Online** → **Map Viewer**

2. Click **Add** → **Add Layer from URL**

3. Enter your layer URL (replace with YOUR ngrok URL):
   ```
   https://abc123xyz456.ngrok.io/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0
   ```

4. Click **Add Layer**

5. **Success!** Your layer should load and display on the map.

---

## All Test Layers

Replace `https://abc123xyz456.ngrok.io` with YOUR ngrok URL:

### Cities (Points - 50 cities)
```
https://abc123xyz456.ngrok.io/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0
```

### Highways (LineStrings - 5 major highways)
```
https://abc123xyz456.ngrok.io/databricks/rest/services/atrivedi.geospatial.koop_test_highways/FeatureServer/0
```

### States (Polygons - 5 states)
```
https://abc123xyz456.ngrok.io/databricks/rest/services/atrivedi.geospatial.koop_test_states/FeatureServer/0
```

### Parks (Points - 10 national parks)
```
https://abc123xyz456.ngrok.io/databricks/rest/services/atrivedi.geospatial.koop_test_parks/FeatureServer/0
```

---

## Troubleshooting

### "Authentication disabled" not showing

**Problem:** Server still shows authentication enabled

**Solution:**
```bash
# Stop server (Ctrl+C)
# Edit .env
nano .env
# Change: AUTH_MODE="disabled"
# Save and restart: npm start
```

### Layer returns 404 or error

**Problem:** Still using old warehouse path

**Solution:**
```bash
# Check .env has correct warehouse
cat .env | grep HTTP_PATH
# Should show: DATABRICKS_HTTP_PATH="/sql/1.0/warehouses/862f1d757f0424f7"
```

### ngrok URL not working

**Problem:** Koop not running or ngrok pointing to wrong port

**Solution:**
```bash
# Make sure Koop is on port 8080
lsof -i :8080
# Should show node process

# Make sure ngrok is forwarding 8080
ngrok http 8080
```

### ArcGIS Online can't connect

**Problem:** Using HTTP instead of HTTPS, or firewall blocking

**Solution:**
- Always use the **HTTPS** ngrok URL (not HTTP)
- Check ngrok terminal for incoming requests
- ngrok free tier has 40 requests/minute limit

---

## Next Steps

Once you've verified this works with ArcGIS Online:

### Option A: Keep using ngrok
- Free tier works for testing
- Pay $10/month for permanent URL
- Your Mac must stay running

### Option B: Deploy to free cloud platform (Recommended for production)
- **Render.com** (750 hours/month free)
- **Railway.app** ($5/month)
- **Fly.io** (free tier available)
- See `docs/ARCGIS_ONLINE_SOLUTIONS.md` for deployment guides

---

## Why Databricks Apps Doesn't Work

```
┌──────────────────┐
│  ArcGIS Online   │  Makes HTTP request
└─────────┬────────┘
          │
          ▼
┌──────────────────┐
│ Databricks Apps  │  Returns 302 redirect to OAuth login
└─────────┬────────┘
          │
          ▼
┌──────────────────┐
│  Login Page      │  ❌ ArcGIS Online can't handle browser login
└──────────────────┘
```

**Databricks Apps always requires OAuth** - there's no way to bypass it even with `authentication.required: false`.

---

## Summary

✅ **Local Koop** = Full control, works with ArcGIS Online
✅ **ngrok** = Public HTTPS URL for testing
✅ **AUTH_MODE=disabled** = No tokens required, simple access
❌ **Databricks Apps** = OAuth only, incompatible with ArcGIS Online

**Recommendation:** Use ngrok for testing now, then deploy to Render.com for production.
