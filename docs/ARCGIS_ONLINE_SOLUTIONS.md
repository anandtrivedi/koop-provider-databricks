# ArcGIS Online Integration Solutions

## Problem Statement

Databricks Apps deployment works in the browser but **does NOT work with ArcGIS Online** because:

1. **Databricks Apps enforces OAuth** (cookie-based, requires browser login)
2. **ArcGIS Online needs token-based auth** (programmatic, no browser)
3. **Cannot use EC2** due to company permission restrictions

---

## Solution Options (No EC2 Required)

### ✅ Option 1: Free Cloud Platform Deployment (RECOMMENDED)

Deploy Koop on a **free tier platform** that doesn't require AWS permissions:

#### Platform Options:

##### A. Render.com (Recommended)
- **Free tier**: 750 hours/month
- **Built-in HTTPS**
- **Easy deployment from GitHub**
- **No credit card required**

**Steps:**
1. Push your code to GitHub
2. Create Render account
3. New Web Service → Connect GitHub repo
4. Set environment variables:
   ```
   DATABRICKS_SERVER_HOSTNAME=e2-demo-field-eng.cloud.databricks.com
   DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/862f1d757f0424f7
   DATABRICKS_TOKEN=dapi_your_token_here
   AUTH_MODE=disabled
   PORT=8000
   ```
5. Deploy!

**Result**: `https://koop-databricks.onrender.com/databricks/rest/services/...`

##### B. Railway.app
- **Free tier**: $5 credit/month
- **Automatic HTTPS**
- **GitHub integration**

##### C. Fly.io
- **Free tier**: 3 shared VMs
- **Global edge deployment**
- **CLI-based deployment**

##### D. Vercel (for serverless approach)
- **Completely free**
- **Serverless functions**
- **Would require slight code modification**

---

### ✅ Option 2: Local Development + Tunnel (Fastest to Test)

Run Koop locally and expose via a secure tunnel:

#### Option 2A: ngrok (Easiest)

```bash
# Install ngrok
brew install ngrok

# Start Koop locally
cd /Users/anand.trivedi/Documents/gitprojects/koop-provider-databricks
npm start

# In another terminal, expose it
ngrok http 8080
```

**Result**: ngrok gives you a public URL like `https://abc123.ngrok.io`

**Pros:**
- Works immediately
- No deployment needed
- Perfect for testing

**Cons:**
- URL changes on each restart (free tier)
- Requires your Mac to stay running
- 40 requests/minute limit (free tier)

#### Option 2B: Cloudflare Tunnel (Free Forever)

```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Start tunnel
cloudflared tunnel --url http://localhost:8080
```

**Result**: Cloudflare gives you a public URL

**Pros:**
- Completely free
- Good performance
- Reliable

**Cons:**
- Requires your Mac running

---

### ✅ Option 3: Use AUTH_MODE=disabled Properly

The provider already supports **no authentication** mode. This means:
- No token required
- Direct access to FeatureServer
- Works perfectly with ArcGIS Online

**Current Issue**: Your root `.env` has `AUTH_MODE="enabled"` but no `config/auth.json` configured.

**Fix:**

1. **Update root .env file**:
   ```bash
   # /Users/anand.trivedi/Documents/gitprojects/koop-provider-databricks/.env
   AUTH_MODE="disabled"
   ```

2. **Redeploy** using ANY of the methods above (Render, ngrok, etc.)

3. **Test**:
   ```bash
   curl https://your-deployment-url/databricks/rest/info
   ```

   **Should return**:
   ```json
   {
     "currentVersion": 11.2,
     "fullVersion": "11.2.0",
     "authInfo": {},  ← Empty! No auth required
     "metadata": {"maxRecordCount": 2000}
   }
   ```

4. **Add to ArcGIS Online**:
   ```
   https://your-deployment-url/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0
   ```

---

## Recommended Approach (Step-by-Step)

### Phase 1: Quick Test with ngrok (5 minutes)

1. **Fix local .env**:
   ```bash
   cd /Users/anand.trivedi/Documents/gitprojects/koop-provider-databricks
   # Edit .env and change AUTH_MODE="enabled" to "disabled"
   ```

2. **Start Koop locally**:
   ```bash
   npm start
   ```

3. **Expose with ngrok** (in another terminal):
   ```bash
   ngrok http 8080
   ```

4. **Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

5. **Test in browser**:
   ```
   https://abc123.ngrok.io/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0?f=json
   ```

6. **Add to ArcGIS Online**:
   - Go to ArcGIS Online
   - Add → Add Layer from URL
   - Paste: `https://abc123.ngrok.io/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0`
   - Should work immediately (no token required)!

### Phase 2: Production Deployment on Render (15 minutes)

1. **Create GitHub repo** (if not already):
   ```bash
   cd /Users/anand.trivedi/Documents/gitprojects/koop-provider-databricks
   git remote add origin https://github.com/your-username/koop-provider-databricks.git
   git push -u origin main
   ```

2. **Sign up at Render.com** (free, no credit card)

3. **Create new Web Service**:
   - Connect GitHub repo
   - Name: `koop-databricks`
   - Environment: Node
   - Build command: `npm install`
   - Start command: `npm start`

4. **Add environment variables**:
   ```
   DATABRICKS_SERVER_HOSTNAME=e2-demo-field-eng.cloud.databricks.com
   DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/862f1d757f0424f7
   DATABRICKS_TOKEN=dapi_your_token_here
   AUTH_MODE=disabled
   LOG_LEVEL=INFO
   PORT=8000
   ```

5. **Deploy** (automatic)

6. **Result**: Permanent URL like `https://koop-databricks.onrender.com`

7. **Use in ArcGIS Online**:
   ```
   https://koop-databricks.onrender.com/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0
   ```

---

## Why Databricks Apps Won't Work

```
┌─────────────────────┐
│  ArcGIS Online      │
│  (Needs tokens)     │
└──────────┬──────────┘
           │
           │ HTTP Request
           │
           ▼
┌─────────────────────┐
│  Databricks Apps    │
│  (OAuth Required)   │
└──────────┬──────────┘
           │
           │ 302 Redirect to Login
           │
           ▼
┌─────────────────────┐
│  OAuth Login Page   │  ← ArcGIS Online can't handle this!
│  (Browser Only)     │
└─────────────────────┘
```

**Databricks Apps OAuth Flow:**
1. Request comes in
2. No browser session cookie → 302 redirect
3. Redirect to OAuth login page
4. User logs in via browser
5. Cookie stored in browser
6. Future requests include cookie

**Problem**: ArcGIS Online makes programmatic requests (no browser), so it:
- Can't follow redirects to login page
- Can't authenticate via browser
- Can't store session cookies
- **FAILS** with 302 or 401 errors

---

## Comparison Matrix

| Solution | Cost | Permanent URL | Setup Time | Requires Mac Running |
|----------|------|---------------|------------|---------------------|
| **Render.com** | Free | ✅ Yes | 15 min | ❌ No |
| **Railway** | $5/month | ✅ Yes | 15 min | ❌ No |
| **Fly.io** | Free | ✅ Yes | 20 min | ❌ No |
| **ngrok** | Free | ❌ Changes | 5 min | ✅ Yes |
| **Cloudflare Tunnel** | Free | ⚠️ Changes | 10 min | ✅ Yes |
| **Databricks Apps** | Free | ✅ Yes | N/A | ❌ No *(OAuth issue)* |

---

## Security Considerations

### For AUTH_MODE=disabled (public deployment):

**Risks:**
- Anyone with the URL can access your data
- No usage tracking per client
- Databricks token exposed in config

**Mitigations:**
1. **Use Databricks access controls**: Restrict what the PAT token can access
2. **Network restrictions**: Configure allowed IPs in Databricks
3. **Monitor usage**: Check Databricks logs for unexpected queries
4. **Rotate tokens**: Change DATABRICKS_TOKEN regularly

### For AUTH_MODE=enabled:

If you want authentication, you'd need to:
1. Create `config/auth.json` with API keys
2. Generate session tokens
3. Pass tokens to ArcGIS Online in URLs

**This works** but adds complexity. For internal use with Databricks access controls, `disabled` mode is often sufficient.

---

## Next Steps

**Recommended:**
1. ✅ Test locally with ngrok (validate it works with ArcGIS Online)
2. ✅ Deploy to Render.com (get permanent public URL)
3. ✅ Add layers to ArcGIS Online
4. ✅ Configure Databricks access controls for security

**Alternative if company allows:**
- Get permission to use Railway ($5/month)
- Get permission to use Fly.io (free tier)

---

## Testing Checklist

- [ ] Update root .env: `AUTH_MODE="disabled"`
- [ ] Start Koop locally: `npm start`
- [ ] Expose with ngrok: `ngrok http 8080`
- [ ] Test REST info: `/databricks/rest/info` (should show `"authInfo": {}`)
- [ ] Test layer metadata: `/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0?f=json`
- [ ] Test layer query: `/databricks/rest/services/atrivedi.geospatial.koop_test_cities/FeatureServer/0/query?where=1=1&f=json`
- [ ] Add to ArcGIS Online Map Viewer
- [ ] Verify data loads and renders correctly

---

## Support

If you need help with any of these options, let me know which approach you'd like to try first!
