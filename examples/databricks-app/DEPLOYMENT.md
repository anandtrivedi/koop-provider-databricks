# Databricks App Deployment Guide with Authentication

This guide shows how to deploy the Koop provider with authentication to Databricks Apps.

## Prerequisites

- Databricks CLI installed (`pip install databricks-cli`)
- Databricks workspace with Apps enabled
- SQL Warehouse or general-purpose cluster configured

---

## Quick Start

### Step 1: Configure Environment

Update `app.yaml` with your Databricks credentials:

```yaml
env:
  - name: DATABRICKS_SERVER_HOSTNAME
    value: your-workspace.cloud.databricks.com
  - name: DATABRICKS_HTTP_PATH
    value: /sql/1.0/warehouses/your-warehouse-id
  - name: DATABRICKS_TOKEN
    value: your-databricks-token
  - name: AUTH_MODE
    value: "disabled"  # or "enabled" for API key authentication
```

### Step 2: Deploy

```bash
cd examples/databricks-app

# First time deployment
databricks apps create koop-databricks-provider --source-code-path .

# Update existing app
databricks apps update koop-databricks-provider --source-code-path .
```

### Step 3: Get Your URL

```bash
databricks apps get koop-databricks-provider
```

Your app will be available at:
```
https://<workspace-id>.databricksapps.com/<app-id>/databricks/rest/services/<table>/FeatureServer/0
```

---

## Authentication Modes

### Mode 1: Disabled (Default)

**Configuration:**
```yaml
env:
  - name: AUTH_MODE
    value: "disabled"
```

**Usage:**
- No token required
- Uses Databricks credentials from environment
- Best for: Development, private networks

**Test:**
```bash
curl "https://your-app-url/databricks/rest/info"
# Should return: "authInfo": {}
```

### Mode 2: Enabled (API Key Authentication)

**Configuration:**
```yaml
env:
  - name: AUTH_MODE
    value: "enabled"
  - name: TOKEN_EXPIRATION_SECONDS
    value: "3600"
```

**Setup:**

1. Generate API keys:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. Create `config/auth.json`:
```json
{
  "clients": {
    "your-generated-api-key": {
      "name": "Production Client",
      "enabled": true,
      "databricks": {
        "token": "dapi...",
        "serverHostname": "workspace.cloud.databricks.com",
        "httpPath": "/sql/1.0/warehouses/..."
      }
    }
  }
}
```

3. Redeploy:
```bash
databricks apps update koop-databricks-provider --source-code-path .
```

**Usage:**

1. Obtain token:
```bash
curl -X POST "https://your-app-url/databricks/tokens/" \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your-generated-api-key"}'
```

2. Use token:
```bash
curl "https://your-app-url/databricks/rest/services/table/FeatureServer/0?token=SESSION_TOKEN"
```

---

## Testing Deployment

### Test 1: Service Info
```bash
curl "https://your-app-url/databricks/rest/info"
```

Expected:
```json
{
  "currentVersion": 10.51,
  "fullVersion": "10.5.1",
  "authInfo": {},
  "metadata": {"maxRecordCount": 2000}
}
```

### Test 2: FeatureServer Metadata
```bash
curl "https://your-app-url/databricks/rest/services/catalog.schema.table/FeatureServer/0?f=json"
```

### Test 3: Query Features
```bash
curl "https://your-app-url/databricks/rest/services/catalog.schema.table/FeatureServer/0/query?where=1=1&resultRecordCount=5&f=json"
```

---

## Adding to ArcGIS Online

1. Go to [ArcGIS Online](https://www.arcgis.com)
2. Create new Web Map
3. Click **Add** → **Add Layer from URL**
4. Select **"An ArcGIS Server Web Service"**
5. Paste your FeatureServer URL:
   ```
   https://your-app-url/databricks/rest/services/catalog.schema.table/FeatureServer/0
   ```
6. Click **Add Layer**

**With Authentication Enabled:**
- ArcGIS Online will detect token-based security
- It will prompt for credentials
- Provide your API key to get a session token
- Token is automatically included in subsequent requests

---

## Troubleshooting

### App won't start
```bash
# Check app logs
databricks apps logs koop-databricks-provider

# Common issues:
# - Missing environment variables
# - Invalid Databricks credentials
# - Port conflicts
```

### Authentication not working
```bash
# Verify AUTH_MODE is set
databricks apps get koop-databricks-provider | grep AUTH_MODE

# Check if config/auth.json exists and is valid
ls -la config/auth.json
cat config/auth.json | python -m json.tool
```

### Features not displaying
```bash
# Test the warehouse connection
curl "https://your-app-url/databricks/rest/info"

# Check table exists
# In Databricks SQL Editor:
SELECT * FROM catalog.schema.table LIMIT 1
```

---

## Security Best Practices

1. **Use Secrets for Production:**
```yaml
env:
  - name: DATABRICKS_TOKEN
    secret:
      scope: your-secret-scope
      key: databricks-token
```

2. **Enable Authentication for Public Apps:**
```yaml
env:
  - name: AUTH_MODE
    value: "enabled"
```

3. **Use HTTPS Only:**
```yaml
env:
  - name: KOOP_AUTH_HTTP
    value: "false"
```

4. **Rotate API Keys Regularly**

5. **Monitor Access Logs**

---

## Files in This Deployment

```
examples/databricks-app/
├── app.yaml                    # Databricks Apps configuration
├── server.js                   # Koop server entry point
├── Dockerfile                  # Container definition
├── provider-lib/               # Local provider with authentication
│   ├── index.js               # Provider definition
│   ├── model.js               # Data model
│   ├── controller.js          # Route controller
│   ├── routes.js              # Custom routes
│   ├── logger.js              # Logging utility
│   └── auth/                  # Authentication modules
│       ├── authenticate.js    # Token issuance
│       ├── authorize.js       # Token validation
│       ├── credentials.js     # API key mapping
│       └── authentication-specification.js
├── config/                     # Configuration files
│   ├── default.json           # Provider config
│   ├── auth.example.json      # Auth template
│   └── auth.json              # Your API keys (gitignored)
├── docs/                       # Documentation
│   └── AUTHENTICATION.md      # Auth guide
└── public/                     # Demo web pages (optional)
```

---

## Additional Resources

- [Databricks Apps Documentation](https://docs.databricks.com/en/apps/index.html)
- [Koop Documentation](https://koopjs.github.io/)
- [ArcGIS REST API](https://developers.arcgis.com/rest/)
- [Main Authentication Guide](docs/AUTHENTICATION.md)

---

## Support

For issues:
1. Check app logs: `databricks apps logs koop-databricks-provider`
2. Review [AUTHENTICATION.md](docs/AUTHENTICATION.md)
3. Test locally first: `npm start` in project root
4. Check GitHub issues

---

**Your deployment is ready!** 🚀

Test it locally first, then deploy to Databricks Apps and test with ArcGIS Online.
