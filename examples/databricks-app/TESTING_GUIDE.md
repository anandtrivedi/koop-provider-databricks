# Authentication Testing Guide

Follow these steps to test the authentication implementation.

## Prerequisites

- Node.js installed
- Databricks credentials configured in `.env`

---

## Test 1: Disabled Mode (Default Behavior)

### Step 1: Ensure AUTH_MODE is disabled

Check your `.env` file:
```bash
cat .env
```

Make sure it does NOT have `AUTH_MODE="enabled"`, or it says `AUTH_MODE="disabled"`.

### Step 2: Start the server

```bash
npm start
```

**Expected output:**
```
Authentication disabled for Databricks provider (using environment variables)
```

### Step 3: Test REST info endpoint

In a new terminal:
```bash
curl http://localhost:8080/databricks/rest/info
```

**Expected response:**
```json
{
  "currentVersion": 10.51,
  "fullVersion": "10.5.1",
  "authInfo": {},
  "metadata": {"maxRecordCount": 2000}
}
```

**Note:** `"authInfo": {}` is empty - no authentication required!

### Step 4: Test FeatureServer endpoint

Replace `YOUR_TABLE` with an actual table name (e.g., `samples.nyctaxi.trips`):

```bash
curl "http://localhost:8080/databricks/rest/services/YOUR_TABLE/FeatureServer/0?f=json"
```

**Expected:** Should return metadata about the table without requiring a token.

### Step 5: Test token endpoint (should fail gracefully)

```bash
curl -X POST http://localhost:8080/databricks/tokens/ \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "test-key"}'
```

**Expected response:**
```json
{
  "error": {
    "code": 400,
    "message": "Authentication is disabled. No token required."
  }
}
```

✅ **Test 1 Complete:** Disabled mode works as expected!

---

## Test 2: Enabled Mode

### Step 1: Generate an API key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example output:**
```
a7f8e9d4c6b2a1f0e8d7c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4
```

**Save this key** - you'll use it in the next steps.

### Step 2: Create config/auth.json

```bash
cp config/auth.example.json config/auth.json
```

Edit `config/auth.json` and replace the example API key with your generated key:

```json
{
  "clients": {
    "a7f8e9d4c6b2a1f0e8d7c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4": {
      "name": "Test Client",
      "enabled": true,
      "databricks": {
        "token": "dapi_YOUR_TOKEN_HERE",
        "serverHostname": "your-workspace.cloud.databricks.com",
        "httpPath": "/sql/1.0/warehouses/428aad03ef2b6b5f"
      }
    }
  }
}
```

**Note:** Use your actual Databricks credentials from `.env`.

### Step 3: Enable authentication

Add to your `.env` file:
```bash
AUTH_MODE="enabled"
TOKEN_EXPIRATION_SECONDS=3600
```

### Step 4: Restart the server

Stop the server (Ctrl+C) and start again:
```bash
npm start
```

**Expected output:**
```
Authentication enabled for Databricks provider
Authentication mode: enabled (loaded 1 API keys)
```

### Step 5: Test REST info endpoint (should show token-based security)

```bash
curl http://localhost:8080/databricks/rest/info
```

**Expected response:**
```json
{
  "currentVersion": 10.51,
  "fullVersion": "10.5.1",
  "authInfo": {
    "isTokenBasedSecurity": true,
    "tokenServicesUrl": "http://localhost:8080/databricks/tokens/"
  },
  "metadata": {"maxRecordCount": 2000}
}
```

**Note:** Now `authInfo` contains token information!

### Step 6: Test FeatureServer without token (should fail)

```bash
curl "http://localhost:8080/databricks/rest/services/YOUR_TABLE/FeatureServer/0?f=json"
```

**Expected response:**
```json
{
  "error": {
    "code": 401,
    "message": "Not Authorized: Missing authentication token..."
  }
}
```

✅ **Good!** Unauthorized access is blocked.

### Step 7: Obtain a session token

Use your API key from Step 1:

```bash
curl -X POST http://localhost:8080/databricks/tokens/ \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "a7f8e9d4c6b2a1f0e8d7c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4"}'
```

**Expected response:**
```json
{
  "token": "xyz123abc456def789...",
  "expires": 1640000000000,
  "ssl": false
}
```

**Save the token** - you'll use it in the next step!

### Step 8: Test FeatureServer WITH token (should succeed)

Replace `YOUR_TOKEN` with the token from Step 7:

```bash
curl "http://localhost:8080/databricks/rest/services/YOUR_TABLE/FeatureServer/0?token=YOUR_TOKEN&f=json"
```

**Expected:** Should return table metadata successfully!

✅ **Test 2 Complete:** Enabled mode works with token authentication!

---

## Test 3: Invalid API Key (should fail)

```bash
curl -X POST http://localhost:8080/databricks/tokens/ \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "invalid-fake-key-12345"}'
```

**Expected response:**
```json
{
  "error": {
    "code": 401,
    "message": "Invalid API key"
  }
}
```

✅ **Good!** Invalid keys are rejected.

---

## Test 4: Expired Token (optional)

To test token expiration, set a very short expiration:

1. Edit `.env`:
   ```bash
   TOKEN_EXPIRATION_SECONDS=5
   ```

2. Restart server

3. Get a token (Step 7)

4. Wait 6 seconds

5. Try to use the token (Step 8)

**Expected:** Should return "Token has expired" error.

---

## Test 5: Disabled API Key

Edit `config/auth.json` and set `"enabled": false`:

```json
{
  "clients": {
    "your-api-key": {
      "name": "Test Client",
      "enabled": false,
      ...
    }
  }
}
```

Restart server and try to get a token with that API key.

**Expected:** Should return "Invalid API key" error.

---

## Test 6: Multiple Workspaces (optional)

Add a second API key for a different workspace:

```json
{
  "clients": {
    "api-key-1": {
      "name": "Workspace 1",
      "enabled": true,
      "databricks": {
        "token": "dapi_workspace1...",
        "serverHostname": "workspace1.databricks.com",
        "httpPath": "/sql/1.0/warehouses/..."
      }
    },
    "api-key-2": {
      "name": "Workspace 2",
      "enabled": true,
      "databricks": {
        "token": "dapi_workspace2...",
        "serverHostname": "workspace2.databricks.com",
        "httpPath": "/sql/1.0/warehouses/..."
      }
    }
  }
}
```

Test that each API key connects to its respective workspace.

---

## Troubleshooting

### Server won't start

```bash
# Check if port 8080 is in use
lsof -i :8080

# Kill the process
kill -9 <PID>
```

### "config/auth.json not found"

```bash
# Create from example
cp config/auth.example.json config/auth.json

# Edit with your API keys
nano config/auth.json
```

### Token not working

- Check that token hasn't expired
- Verify you're using the correct token from the response
- Make sure AUTH_MODE=enabled in .env

### Check server logs

Look for authentication-related messages:
```bash
# In the terminal where server is running, look for:
# - "Authentication enabled/disabled"
# - "Issued session token for API key"
# - "Request authorized with token"
# - "Invalid API key provided"
```

---

## Summary Checklist

- [ ] Test 1: Disabled mode works without tokens
- [ ] Test 2: Enabled mode requires tokens
- [ ] Test 3: Invalid API keys rejected
- [ ] Test 4: Tokens expire correctly
- [ ] Test 5: Disabled keys don't work
- [ ] Test 6: Multiple workspaces supported

---

## Next Steps

Once testing is complete:

1. **For production:**
   - Set `AUTH_MODE=enabled`
   - Use strong API keys (64+ characters)
   - Use HTTPS (set `KOOP_AUTH_HTTP=false`)
   - Set appropriate token expiration
   - Monitor logs for security issues

2. **For development:**
   - Can use `AUTH_MODE=disabled` for convenience
   - Use HTTP for local testing

3. **Merge to main:**
   ```bash
   git checkout main
   git merge auth-api-key-mapper
   git push origin main
   ```

---

## Questions?

See `docs/AUTHENTICATION.md` for more details.
