/**
 * Koop Server with Databricks Provider
 *
 * Deployment Options:
 * - Option A (API Only): Deploy just the FeatureServer REST API
 * - Option B (Full Solution): Deploy API + optional demo web pages
 *
 * This is an example deployment app. Most users should integrate
 * the provider into their own applications instead of using this.
 *
 * See README.md for more information.
 */

const Koop = require('@koopjs/koop-core')
const databricksProvider = require('@databricks/koop-provider')
const express = require('express')
const path = require('path')
const fs = require('fs')

// Create Koop instance
const koop = new Koop({ logLevel: process.env.LOG_LEVEL || 'info' })

// Register Databricks provider
koop.register(databricksProvider)

// OPTIONAL: Serve static demo pages if SERVE_DEMO_PAGES=true
// This is useful for Databricks Apps deployment to provide a complete solution
const serveDemoPages = process.env.SERVE_DEMO_PAGES === 'true'

if (serveDemoPages) {
  const publicDir = path.join(__dirname, 'public')

  // Check if public directory exists
  if (fs.existsSync(publicDir)) {
    console.log('📁 Serving demo pages from /public directory')
    koop.server.use(express.static(publicDir))

    // Serve index.html at root
    koop.server.get('/', (req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'))
    })
  } else {
    console.log('⚠️  SERVE_DEMO_PAGES=true but /public directory not found')
  }
}

// Start server
// Default to 8000 (Databricks Apps default) or 8080 for local development
const port = process.env.PORT || 8000
koop.server.listen(port, () => {
  console.log(``)
  console.log(`🚀 Koop Databricks Provider Server`)
  console.log(`================================================`)
  console.log(``)
  console.log(`📡 FeatureServer API:`)
  console.log(`   http://localhost:${port}/databricks/rest/info`)
  console.log(`   http://localhost:${port}/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0`)
  console.log(``)

  if (serveDemoPages) {
    console.log(`🗺️  Demo Pages:`)
    console.log(`   http://localhost:${port}/             (Home)`)
    console.log(`   http://localhost:${port}/multi-layer-map.html`)
    console.log(`   http://localhost:${port}/large-dataset-map.html`)
    console.log(``)
  }

  console.log(`🔧 Configuration:`)
  console.log(`   DATABRICKS_SERVER_HOSTNAME: ${process.env.DATABRICKS_SERVER_HOSTNAME || 'NOT SET'}`)
  console.log(`   DATABRICKS_HTTP_PATH: ${process.env.DATABRICKS_HTTP_PATH || 'NOT SET'}`)
  console.log(`   DATABRICKS_TOKEN: ${process.env.DATABRICKS_TOKEN ? '***SET***' : 'NOT SET'}`)
  console.log(`   SERVE_DEMO_PAGES: ${serveDemoPages}`)
  console.log(``)
  console.log(`================================================`)
  console.log(``)
})
