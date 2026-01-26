# Deploy to Render.com (Production-Ready, Free Tier)

This guide shows how to deploy Koop to Render.com for a **permanent public URL** that works with ArcGIS Online.

---

## Why Render.com?

✅ **Free Tier**: 750 hours/month (enough for always-on service)
✅ **HTTPS Built-in**: Automatic SSL certificates
✅ **GitHub Integration**: Deploy from your repo
✅ **No Credit Card**: Free tier doesn't require payment method
✅ **Simple**: Easy configuration via UI
✅ **No AWS Permissions**: Works without company cloud access

---

## Prerequisites

1. **GitHub Account**: https://github.com
2. **Render Account**: https://render.com (free signup)
3. **Your code pushed to GitHub**

---

## Step 1: Push Code to GitHub (if not already done)

```bash
cd /Users/anand.trivedi/Documents/gitprojects/koop-provider-databricks

# Initialize git (if needed)
git remote -v

# If no remote, add one:
# git remote add origin https://github.com/YOUR_USERNAME/koop-provider-databricks.git

# Commit latest changes
git add .
git commit -m "Prepare for Render deployment with AUTH_MODE=disabled"

# Push to GitHub
git push origin main
```

---

## Step 2: Create Render Account

1. Go to https://render.com
2. Click **Get Started**
3. Sign up with GitHub (easiest)
4. Authorize Render to access your repositories

---

## Step 3: Create New Web Service

1. Click **New +** → **Web Service**

2. **Connect GitHub Repository**:
   - Find: `koop-provider-databricks`
   - Click **Connect**

3. **Configure Service**:
   - **Name**: `koop-databricks` (or any name you like)
   - **Region**: Oregon (US West) or closest to you
   - **Branch**: `main`
   - **Root Directory**: Leave blank (use root)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: **Free**

4. Click **Advanced** to add environment variables

---

## Step 4: Add Environment Variables

Click **Add Environment Variable** for each:

| Key | Value |
|-----|-------|
| `DATABRICKS_SERVER_HOSTNAME` | `e2-demo-field-eng.cloud.databricks.com` |
| `DATABRICKS_HTTP_PATH` | `/sql/1.0/warehouses/862f1d757f0424f7` |
| `DATABRICKS_TOKEN` | `dapi_your_token_here` |
| `AUTH_MODE` | `disabled` |
| `LOG_LEVEL` | `INFO` |
| `PORT` | `8000` |

**Important:** Make sure `AUTH_MODE` is set to `disabled`!

---

## Step 5: Deploy

1. Click **Create Web Service**

2. **Wait for deployment** (takes 2-3 minutes):
   - Installing dependencies...
   - Building...
   - Starting server...
   - ✅ **Live**

3. **Your URL will be**:
   ```
   https://koop-databricks.onrender.com
   ```
   (Or whatever name you chose)

---

## Step 6: Test Your Deployment

### Test REST Info
```bash
curl https://koop-databricks.onrender.com/databricks/rest/info
```

**Expected:**
```json
{
  "currentVersion": 11.2,
  "fullVersion": "11.2.0",
  "authInfo": {},
  "metadata": {"maxRecordCount": 2000}
}
```

### Test Cities Layer
```bash
curl "https://koop-databricks.onrender.com/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0?f=json"
```

Should return layer metadata.

---

## Step 7: Add to ArcGIS Online

1. Go to **ArcGIS Online** → **Map Viewer**

2. Click **Add** → **Add Layer from URL**

3. Enter layer URL:
   ```
   https://koop-databricks.onrender.com/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0
   ```

4. Click **Add Layer**

5. **Success!** ✅

---

## All Layer URLs (Production)

Replace `koop-databricks.onrender.com` with YOUR Render URL:

### Cities (50 points)
```
https://koop-databricks.onrender.com/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0
```

### Highways (5 linestrings)
```
https://koop-databricks.onrender.com/databricks/rest/services/atrivedi.geospatial.koop_test_highways/FeatureServer/0
```

### States (5 polygons)
```
https://koop-databricks.onrender.com/databricks/rest/services/atrivedi.geospatial.koop_test_states/FeatureServer/0
```

### Parks (10 points)
```
https://koop-databricks.onrender.com/databricks/rest/services/atrivedi.geospatial.koop_test_parks/FeatureServer/0
```

---

## Render Dashboard Features

### View Logs
- **Dashboard** → **Your Service** → **Logs**
- See real-time server output
- Debug issues

### Monitor Performance
- **Dashboard** → **Metrics**
- See request rates, memory usage, CPU
- Track uptime

### Manual Deploy
- **Dashboard** → **Manual Deploy** → **Deploy latest commit**
- Redeploy after pushing changes to GitHub

### Environment Variables
- **Dashboard** → **Environment**
- Update variables without redeploying
- Click **Save Changes** to restart with new vars

---

## Free Tier Limits

Render.com free tier includes:

✅ **750 hours/month**: Enough for 24/7 operation
✅ **HTTPS**: Automatic SSL certificates
✅ **Custom domains**: Add your own domain (optional)
✅ **Automatic deploys**: Push to GitHub → auto-deploy
⚠️ **Sleeps after 15min inactivity**: First request after sleep takes ~30 seconds
⚠️ **Shared resources**: Performance may vary under load

**Note:** For production with no sleep, upgrade to paid tier ($7/month).

---

## Updating Your Deployment

When you make changes locally:

```bash
cd /Users/anand.trivedi/Documents/gitprojects/koop-provider-databricks

# Make your changes
# Edit files...

# Commit and push
git add .
git commit -m "Update configuration"
git push origin main
```

**Render will automatically**:
1. Detect the push
2. Build new version
3. Deploy it
4. Switch traffic to new version
5. All in ~2-3 minutes

---

## Troubleshooting

### Service won't start

**Problem:** Build or start command failing

**Solution:**
1. Check Render logs: Dashboard → Logs
2. Common issues:
   - Missing environment variables
   - Wrong start command (should be `npm start`)
   - Dependencies not installing

### "authInfo" showing authentication

**Problem:** `AUTH_MODE` not set to `disabled`

**Solution:**
1. Go to: Dashboard → Environment
2. Find `AUTH_MODE`
3. Change to `disabled`
4. Click **Save Changes** (service will restart)

### Layer returns 404 or Internal Server Error

**Problem:** Databricks credentials incorrect or warehouse not accessible

**Solution:**
1. Check environment variables match your `.env` file
2. Verify `DATABRICKS_HTTP_PATH` is correct: `/sql/1.0/warehouses/862f1d757f0424f7`
3. Check Render logs for error messages
4. Test Databricks connection locally first

### ArcGIS Online can't connect

**Problem:** Layer URL incorrect or service sleeping

**Solution:**
1. Make sure using `https://` (not `http://`)
2. Test URL in browser first
3. If service is sleeping, first request takes ~30 seconds
4. Check Render status: Dashboard → should show "Live"

---

## Security Best Practices

### 1. Use Databricks Access Controls

Restrict what the PAT token can access:
- Go to Databricks workspace
- Admin Console → Access Control
- Configure table/schema permissions

### 2. Rotate Databricks Token Regularly

```bash
# Generate new token in Databricks
# Update Render environment variable
# Service will automatically restart
```

### 3. Monitor Usage

- Check Render logs for unusual activity
- Monitor Databricks query history
- Set up alerts for high usage

### 4. Consider Authentication

If you need access control, see `docs/AUTHENTICATION.md` for enabling API key authentication.

---

## Comparison: Render vs Databricks Apps

| Feature | Render.com | Databricks Apps |
|---------|-----------|----------------|
| **ArcGIS Online Support** | ✅ Yes | ❌ No (OAuth required) |
| **Cost** | Free tier | Free |
| **HTTPS** | ✅ Included | ✅ Included |
| **Custom Auth** | ✅ Configurable | ❌ OAuth only |
| **Setup Time** | 15 minutes | 10 minutes |
| **Control** | Full control | Limited |
| **Deployment** | Git push | `databricks apps deploy` |

**Winner for ArcGIS Online:** **Render.com** ✅

---

## Alternative Cloud Platforms

If you prefer other platforms:

### Railway.app
- Similar to Render
- $5/month (no free tier)
- Excellent UI
- GitHub integration

### Fly.io
- Free tier: 3 shared VMs
- CLI-based deployment
- Global edge deployment
- More technical

### Vercel
- Completely free
- Serverless architecture
- Would require code modifications
- Best for lightweight APIs

---

## Next Steps

1. ✅ **Deploy to Render.com** (follow steps above)
2. ✅ **Test with ArcGIS Online**
3. ✅ **Share layers with your team**
4. 📚 **Read**: `docs/AUTHENTICATION.md` (if you need access control)
5. 📚 **Read**: `docs/PERFORMANCE_OPTIMIZATION.md` (for large datasets)

---

## Support

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **This Project**: See `docs/AUTHENTICATION.md`, `docs/ARCGIS_ONLINE_SOLUTIONS.md`

---

## Summary

✅ **Render.com is the best solution** for deploying Koop with ArcGIS Online support
✅ **Free tier** works great for testing and small-scale production
✅ **No AWS permissions required**
✅ **Permanent HTTPS URL**
✅ **Automatic deployments from GitHub**
✅ **Works perfectly with ArcGIS Online** (no OAuth issues)

**Total setup time:** ~15 minutes from start to finish! 🚀
