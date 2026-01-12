# Databricks Deployment Example

**NOTE: This example app is NOT required to use the Koop Databricks Provider.**

This is a minimal example showing how to deploy the Koop Databricks Provider to Databricks Apps or Model Serving. Most users will integrate the provider into their own applications.

## What Is This?

This folder contains a **standalone deployment example** that:
- Uses the Koop Databricks Provider as a dependency
- Provides a simple server that can be deployed to Databricks
- Is completely optional - you can deploy the provider in your own way

**📐 Architecture Diagram**: See [DATABRICKS_DEPLOYMENT.md](../../DATABRICKS_DEPLOYMENT.md#architecture-overview) for a detailed architecture diagram showing how all components work together.

## When Would You Use This?

Use this example if you want to:
1. Quickly test the provider on Databricks without writing your own app
2. See a reference implementation for deploying to Databricks
3. Have a starting point for your own deployment

## How to Use the Provider (Normal Usage)

**Most users should NOT use this example app.** Instead, install the provider in your own application:

```bash
npm install @databricks/koop-provider
```

Then use it in your code:

```javascript
const Koop = require('@koopjs/koop-core')
const databricksProvider = require('@databricks/koop-provider')

const koop = new Koop()
koop.register(databricksProvider)
koop.server.listen(8080)
```

See the main README for full documentation.

## Using This Example for Deployment

If you want to use this example to deploy to Databricks:

### Option 1: Deploy to Databricks Apps

```bash
# From this directory
cd examples/databricks-app

# Build Docker image
docker build -t koop-databricks-app .

# Deploy using Databricks CLI
databricks apps create koop-databricks \
  --source-code-path .
```

### Option 2: Deploy to Model Serving

```bash
# Build and tag
docker build -t koop-databricks-app .
docker tag koop-databricks-app <workspace-url>/koop-databricks-app:latest

# Push to Databricks
docker push <workspace-url>/koop-databricks-app:latest

# Create serving endpoint
databricks serving-endpoints create --name koop-databricks \
  --config serving-config.json
```

## Files in This Example

- `package.json` - Dependencies (includes the Koop provider)
- `server.js` - Minimal Koop server
- `Dockerfile` - Container image for deployment
- `.env.example` - Environment variables needed
- `README.md` - This file

## Environment Variables

```bash
DATABRICKS_SERVER_HOSTNAME=your-workspace.cloud.databricks.com
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/your-warehouse-id
DATABRICKS_TOKEN=your-token
PORT=8080
```

## Testing Locally

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your credentials

# Start server
npm start

# Test
curl http://localhost:8080/databricks/rest/info
```

## Moving to Separate Repository

This example can easily be moved to its own repository:

```bash
# Copy this folder
cp -r examples/databricks-app ../koop-databricks-deployment

# Initialize git
cd ../koop-databricks-deployment
git init
git add .
git commit -m "Initial commit"
```

## Need Help?

- See main repository README for provider documentation
- Check `../../DATABRICKS_DEPLOYMENT.md` for detailed deployment guide
- Review Databricks Apps documentation: https://docs.databricks.com/apps/
