# Databricks App Authentication Testing Guide

This guide shows how to deploy and test the authentication feature using your Databricks app deployment.

## Overview

We'll deploy the `auth-api-key-mapper` branch to your Databricks app and test both authentication modes:
1. **Disabled mode** (current behavior - no breaking changes)
2. **Enabled mode** (new API key authentication)

---

## Prerequisites

- Databricks CLI installed (`pip install databricks-cli`)
- Access to Databricks workspace with Apps enabled
- Databricks app already deployed (or ready to deploy)

---

## Part 1: Deploy with Authentication Disabled (Test Current Behavior)

This tests that nothing breaks when authentication code is present but disabled.

### Step 1: Update Databricks App Files

The authentication files are already on your `auth-api-key-mapper` branch. You need to copy them to the Databricks app directory:

```bash
# From your project root
cd /Users/anand.trivedi/Documents/gitprojects/koop-provider-databricks

# Copy authentication source files to the app
cp -r src/auth examples/databricks-app/provider-lib/auth/
cp -r config examples/databricks-app/
cp -r docs examples/databricks-app/
cp .env.example examples/databricks-app/

# Verify files copied
ls examples/databricks-app/provider-lib/auth/
# Should show: authenticate.js, authorize.js, credentials.js, authentication-specification.js
```

### Step 2: Update app.yaml

The `app.yaml` has already been updated with authentication env vars (commented out by default).

Ensure these lines are present and commented:
```yaml
# Authentication configuration (optional)
# - name: AUTH_MODE
#   value: "disabled"  # or "enabled" for API key authentication
```

### Step 3: Deploy to Databricks

```bash
cd examples/databricks-app

# If this is first time deploying:
databricks apps create koop-databricks-provider --source-code-path .

# If app already exists (update):
databricks apps update koop-databricks-provider --source-code-path .
```

### Step 4: Get Your App URL

```bash
databricks apps get koop-databricks-provider