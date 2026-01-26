# Authentication Guide

This guide explains how to configure and use authentication with the Databricks Koop Provider.

## Table of Contents

- [Overview](#overview)
- [Authentication Modes](#authentication-modes)
- [Setup Instructions](#setup-instructions)
- [How It Works](#how-it-works)
- [Using with ArcGIS](#using-with-arcgis)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Databricks Koop Provider supports two authentication modes:

1. **Disabled Mode** (Default): No authentication required. Uses environment variables for Databricks credentials.
2. **API Key Mode**: Clients use API keys to obtain session tokens. Databricks credentials stay secure on the server.

### Why Use API Key Authentication?

✅ **Security**: Databricks PAT tokens never leave your server
✅ **Access Control**: Restrict who can access your data
✅ **Multi-Workspace**: Support multiple Databricks workspaces with different keys
✅ **Audit Trail**: Track usage by different clients
✅ **Token Expiration**: Session tokens automatically expire

---

## Authentication Modes

### Mode 1: Disabled (Default)

**When to use:**
- Development/testing environments
- Private networks with existing security
- Single workspace, trusted users only

**Configuration:**
```bash
# .env
AUTH_MODE="disabled"
DATABRICKS_TOKEN="dapi..."
DATABRICKS_SERVER_HOSTNAME="workspace.cloud.databricks.com"
DATABRICKS_HTTP_PATH="/sql/1.0/warehouses/abc123"
```

**Usage:**
- No authentication required
- Access FeatureServer directly: `https://your-server/databricks/rest/services/table/FeatureServer/0`

---

### Mode 2: API Key Enabled

**When to use:**
- Production environments
- Public internet exposure
- Multiple clients/applications
- Multiple Databricks workspaces

**Configuration:**
```bash
# .env
AUTH_MODE="enabled"
TOKEN_EXPIRATION_SECONDS=3600
```

**Usage:**
1. Client obtains session token from `/databricks/tokens/`
2. Client includes token in requests: `?token=session-token-xyz`

---

## Setup Instructions

### Step 1: Generate API Keys

Generate secure API keys for each client:

```bash
# Generate a 64-character hex API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example output:**
```
a7f8e9d4c6b2a1f0e8d7c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4
```

**Generate multiple keys** for different clients/applications.

### Step 2: Create Authentication Configuration

Copy the example configuration:

```bash
cp config/auth.example.json config/auth.json
```

Edit `config/auth.json` with your API keys and Databricks credentials:

```json
{
  "clients": {
    "a7f8e9d4c6b2a1f0e8d7c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4": {
      "name": "Production ArcGIS Team",
      "enabled": true,
      "databricks": {
        "token": "dapi1234567890abcdef...",
        "serverHostname": "prod-workspace.cloud.databricks.com",
        "httpPath": "/sql/1.0/warehouses/abc123xyz456"
      }
    },
    "b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9": {
      "name": "Development Team",
      "enabled": true,
      "databricks": {
        "token": "dapi9876543210fedcba...",
        "serverHostname": "dev-workspace.cloud.databricks.com",
        "httpPath": "/sql/1.0/warehouses/dev789xyz012"
      }
    }
  }
}
```

**Important:** `config/auth.json` is gitignored and will not be committed to version control.

### Step 3: Enable Authentication

Update your `.env` file:

```bash
# Enable authentication
AUTH_MODE="enabled"

# Optional: Set token expiration (default: 3600 seconds = 1 hour)
TOKEN_EXPIRATION_SECONDS=3600

# Optional: Allow HTTP for development (NOT recommended for production)
# KOOP_AUTH_HTTP="true"
```

### Step 4: Restart Koop Server

```bash
npm start
```

You should see:
```
Authentication enabled for Databricks provider
Authentication mode: enabled (loaded 2 API keys)
```

---

## How It Works

### Architecture

```
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│  ArcGIS Client  │           │   Koop Server   │           │   Databricks    │
│  (Online/Pro)   │           │                 │           │                 │
└────────┬────────┘           └────────┬────────┘           └────────┬────────┘
         │                              │                              │
         │ 1. Request token             │                              │
         │    POST /databricks/tokens/  │                              │
         │    Body: { apiKey: "a7f..." }│                              │
         ├─────────────────────────────>│                              │
         │                              │                              │
         │ 2. Return session token      │                              │
         │    { token: "xyz...",        │                              │
         │      expires: 1234567890 }   │                              │
         │<─────────────────────────────┤                              │
         │                              │                              │
         │ 3. Query with token          │                              │
         │    GET /databricks/rest/...  │                              │
         │    ?token=xyz...             │                              │
         ├─────────────────────────────>│                              │
         │                              │ 4. Validate token            │
         │                              │    & get credentials         │
         │                              │                              │
         │                              │ 5. Query Databricks          │
         │                              │    (with PAT token)          │
         │                              ├─────────────────────────────>│
         │                              │                              │
         │                              │ 6. Return data               │
         │                              │<─────────────────────────────┤
         │                              │                              │
         │ 7. Return GeoJSON            │                              │
         │<─────────────────────────────┤                              │
         │                              │                              │
```

### Token Flow

1. **Client obtains session token** using their API key
2. **Server validates API key** and maps to Databricks credentials
3. **Server issues session token** (expires after configured time)
4. **Client includes token in requests** to FeatureServer endpoints
5. **Server validates session token** and uses associated Databricks credentials
6. **Databricks PAT token stays on server** - never exposed to clients

---

## Using with ArcGIS

### ArcGIS Online

#### Step 1: Get Token URL

When authentication is enabled, Koop advertises the token endpoint:

```
https://your-server.com/databricks/tokens/
```

#### Step 2: Obtain Session Token

Use a tool like curl, Postman, or code to get a token:

```bash
curl -X POST https://your-server.com/databricks/tokens/ \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "a7f8e9d4c6b2a1f0e8d7c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4"}'
```

**Response:**
```json
{
  "token": "xyz123abc456def789...",
  "expires": 1640000000000,
  "ssl": true
}
```

#### Step 3: Add Layer to ArcGIS Online

1. Go to **ArcGIS Online** > **Add** > **Add Layer from URL**
2. Enter FeatureServer URL with token:
   ```
   https://your-server.com/databricks/rest/services/catalog.schema.table/FeatureServer/0?token=xyz123abc456def789...
   ```
3. Click **Add Layer**

**Note:** ArcGIS Online can also automatically request tokens if the service advertises `isTokenBasedSecurity: true` in `/rest/info`.

---

### ArcGIS Enterprise

Works identically to ArcGIS Online:

1. Obtain session token using API key
2. Add layer with token parameter in URL
3. Enterprise can access both public and private Koop deployments

---

### ArcGIS Pro

1. **Add Server Connection**:
   - Server URL: `https://your-server.com/databricks/rest/services`
   - Authentication: Token-based

2. **Provide Token**:
   - Obtain token as shown above
   - Enter token in authentication dialog

3. **Browse and Add Layers**:
   - Browse available layers
   - Add to map

---

### JavaScript API

```javascript
// Obtain token first
const response = await fetch('https://your-server.com/databricks/tokens/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    apiKey: 'a7f8e9d4c6b2a1f0e8d7c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4'
  })
});

const { token } = await response.json();

// Create FeatureLayer with token
const featureLayer = new FeatureLayer({
  url: `https://your-server.com/databricks/rest/services/catalog.schema.table/FeatureServer/0?token=${token}`
});

map.add(featureLayer);
```

---

## Security Best Practices

### 1. Use HTTPS in Production

Always use HTTPS for production deployments:

```bash
# .env
# Do NOT set KOOP_AUTH_HTTP=true in production
```

### 2. Rotate API Keys Regularly

Generate new API keys periodically:

```bash
# Generate new key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update config/auth.json
# Notify clients of new key
# Remove old key after transition period
```

### 3. Disable Unused Keys

Temporarily disable keys without deleting:

```json
{
  "clients": {
    "old-api-key": {
      "name": "Deprecated Client",
      "enabled": false,
      "databricks": { ... }
    }
  }
}
```

### 4. Monitor Logs

Check logs for suspicious activity:

```bash
# View authentication logs
pm2 logs koop-provider-databricks | grep "API key"
```

### 5. Use Environment Variables in Production

For production, use environment variables instead of hardcoded credentials:

```json
{
  "clients": {
    "api-key-123": {
      "name": "Production",
      "enabled": true,
      "databricks": {
        "token": "${PROD_DATABRICKS_TOKEN}",
        "serverHostname": "${PROD_DATABRICKS_HOSTNAME}",
        "httpPath": "${PROD_DATABRICKS_HTTP_PATH}"
      }
    }
  }
}
```

### 6. Implement Rate Limiting

Consider adding rate limiting with nginx or similar:

```nginx
limit_req_zone $binary_remote_addr zone=token_limit:10m rate=10r/m;

location /databricks/tokens/ {
    limit_req zone=token_limit burst=5;
    proxy_pass http://localhost:8080;
}
```

### 7. Set Appropriate Token Expiration

Balance security and usability:

```bash
# Development: Longer tokens (4 hours)
TOKEN_EXPIRATION_SECONDS=14400

# Production: Shorter tokens (1 hour)
TOKEN_EXPIRATION_SECONDS=3600
```

---

## Troubleshooting

### Issue: "Authentication is disabled"

**Cause:** `AUTH_MODE` is not set to "enabled"

**Solution:**
```bash
# .env
AUTH_MODE="enabled"
```

Restart server: `npm start`

---

### Issue: "Missing API key"

**Cause:** Token request doesn't include API key

**Solution:** Include API key in request:

```bash
curl -X POST https://your-server.com/databricks/tokens/ \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your-api-key-here"}'
```

---

### Issue: "Invalid API key"

**Causes:**
1. API key not in `config/auth.json`
2. API key has `enabled: false`
3. Typo in API key

**Solution:** Verify API key in `config/auth.json`:

```json
{
  "clients": {
    "correct-api-key-here": {
      "enabled": true,
      ...
    }
  }
}
```

---

### Issue: "Token has expired"

**Cause:** Session token expired (default: 1 hour)

**Solution:** Obtain new token:

```bash
curl -X POST https://your-server.com/databricks/tokens/ \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your-api-key-here"}'
```

---

### Issue: "config/auth.json not found"

**Cause:** Authentication enabled but config file missing

**Solution:**
```bash
# Copy example
cp config/auth.example.json config/auth.json

# Edit with your API keys
nano config/auth.json

# Restart
npm start
```

---

### Issue: ArcGIS Online can't access token endpoint

**Cause:** Token endpoint not publicly accessible

**Solution:**
1. Verify server is publicly accessible (HTTPS required)
2. Check firewall rules allow HTTPS (port 443)
3. Test token endpoint:
   ```bash
   curl -X POST https://your-server.com/databricks/tokens/ \
     -H "Content-Type: application/json" \
     -d '{"apiKey": "test"}'
   ```

---

### Checking Authentication Status

View authentication status in logs:

```bash
# Start server
npm start

# Look for authentication messages
# You should see one of:
# - "Authentication enabled for Databricks provider"
# - "Authentication disabled for Databricks provider (using environment variables)"
```

Check loaded API keys:

```bash
# Logs show number of loaded keys
# "Authentication mode: enabled (loaded 2 API keys)"
```

---

## Additional Resources

- [Koop Documentation](https://koopjs.github.io/docs/)
- [ArcGIS REST API](https://developers.arcgis.com/rest/)
- [Databricks SQL Endpoints](https://docs.databricks.com/sql/admin/sql-endpoints.html)

---

## Support

For issues or questions:
- Check logs: `pm2 logs koop-provider-databricks`
- Review this guide
- Check GitHub issues
